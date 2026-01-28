/* ===== IMPORTS ===== */
const express = require("express");
const geolib = require("geolib");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

/* ===== APP SETUP ===== */
const app = express();
const PORT = process.env.PORT || 3000;

/* ===== DEBUG (REMOVE AFTER CONFIRMING) ===== */
console.log("GOOGLE_CLIENT_ID =", process.env.GOOGLE_CLIENT_ID);
console.log("GOOGLE_CLIENT_SECRET =", process.env.GOOGLE_CLIENT_SECRET);

/* ===== CONFIG ===== */
const VENUE = {
  latitude: 10.007038326077215,
  longitude: 76.3655721586985
};

const MAX_DISTANCE_METERS = 200;
const MAX_GPS_ACCURACY = 250;

/* ===== DATA FILE ===== */
const DATA_FILE = path.join(__dirname, "attendance.json");

/* ===== IN-MEMORY STORAGE ===== */
const attendance = new Set();           // userEmail|date
const deviceAttendance = new Set();     // deviceId|date
let attendanceRecords = [];             // full records

/* ===== LOAD JSON → RAM ON START ===== */
if (fs.existsSync(DATA_FILE)) {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    attendanceRecords = JSON.parse(raw);

    // rebuild locks
    attendanceRecords.forEach(r => {
      attendance.add(`${r.email}|${r.date}`);
      deviceAttendance.add(`${r.deviceId}|${r.date}`);
    });

    console.log(`Loaded ${attendanceRecords.length} records from attendance.json`);
  } catch (err) {
    console.error("Failed to load attendance.json:", err);
    attendanceRecords = [];
  }
}

/* ===== MIDDLEWARE ===== */
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public"));

app.use(
  session({
    secret: "tsog-event-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax"
    }
  })
);

app.use(passport.initialize());
app.use(passport.session());

/* ===== HELPERS ===== */

// YYYY-MM-DD
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Device ID (HTTP-only cookie)
function getDeviceId(req, res) {
  let deviceId = req.cookies.deviceId;

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    res.cookie("deviceId", deviceId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    });
  }

  return deviceId;
}

// Save RAM → JSON
function saveAttendanceToFile() {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(attendanceRecords, null, 2),
    "utf8"
  );
}

/* ===== PASSPORT CONFIG ===== */
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    },
    (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;

      // Optional domain restriction
      // if (!email.endsWith("@jainuniversity.ac.in")) return done(null, false);

      done(null, {
        id: profile.id,
        name: profile.displayName,
        email
      });
    }
  )
);

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

/* ===== AUTH ROUTES ===== */
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => res.redirect("/")
);

/* ===== AUTH GUARD ===== */
function requireLogin(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.redirect("/login.html");
  }
  next();
}

/* ===== ROUTES ===== */

// Attendance page
app.get("/", requireLogin, (req, res) => {
  res.sendFile(__dirname + "/public/attendance.html");
});

/* ===== ATTENDANCE SUBMISSION ===== */
app.post("/attendance", requireLogin, (req, res) => {
  const lat = Number(req.body.lat);
  const lng = Number(req.body.lng);
  const accuracy = Number(req.body.accuracy);

  if (Number.isNaN(lat) || Number.isNaN(lng) || Number.isNaN(accuracy)) {
    return res.status(400).json({ error: "Invalid GPS data" });
  }

  if (accuracy > MAX_GPS_ACCURACY) {
    return res.status(400).json({ error: "GPS accuracy too low" });
  }

  const distance = geolib.getDistance(
    { latitude: lat, longitude: lng },
    VENUE
  );

  if (distance > MAX_DISTANCE_METERS) {
    return res.status(403).json({ error: "You are outside the venue" });
  }

  const userId = req.user.email;
  const today = todayKey();
  const deviceId = getDeviceId(req, res);

  const attendanceKey = `${userId}|${today}`;
  const deviceKey = `${deviceId}|${today}`;

  if (attendance.has(attendanceKey)) {
    return res.status(409).json({ error: "Attendance already marked today" });
  }

  if (deviceAttendance.has(deviceKey)) {
    return res.status(409).json({ error: "Attendance already marked on this device today" });
  }

  // Lock
  attendance.add(attendanceKey);
  deviceAttendance.add(deviceKey);

  // Record
  attendanceRecords.push({
    email: userId,
    studentName: req.body.studentName,
    usn: req.body.usn,
    department: req.body.department,
    specialization: req.body.specialization,
    level: req.body.level,
    semester: req.body.semester,
    committee: req.body.committee,
    date: today,
    time: new Date().toLocaleTimeString(),
    latitude: lat,
    longitude: lng,
    accuracy,
    distance,
    deviceId
  });

  saveAttendanceToFile();

  console.log(`Attendance marked: ${attendanceKey}`);

  res.json({ success: true, date: today, distance });
});

/* ===== LOGOUT ===== */
app.get("/logout", (req, res) => {
  req.logout(() => res.redirect("/login.html"));
});

/* ===== START SERVER ===== */
app.listen(PORT, () => {
  console.log(`Attendance app running on port ${PORT}`);
});
