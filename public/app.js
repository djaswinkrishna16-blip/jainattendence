

/* ========= DATA ========= */

const departments = [
  "Computer Science and Engineering",
  "Computer Science and IT",
  "Data Science",
  "Management Studies",
  "Psychology",
  "Forensic Science",
  "Journalism",
  "Economics",
  "Commerce",
  "English",
  "Marine Science",
  "Design",
  "CGS"
];

const levels = ["UG", "PG"];

const semesters = [
  "Semester 2",
  "Semester 4",
  "Level 7",
  "Level 8",
  "QMU"
];

const committees = [
  "Guinness",
  "Tickets",
  "Hospitality",
  "Discipline",
  "Food Committee",
  "Medical",
  "Registration",
  "PR and Media",
  "Technical Committee",
  "Culturals",
  "Venue management - Kinfra Venue 1",
  "Venue management - Kinfra Venue 2",
  "Not Assigned"
];

/* ========= HELPERS ========= */

function populate(id, items) {
  const select = document.getElementById(id);
  items.forEach(item => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    select.appendChild(option);
  });
}

/* ========= INIT ========= */

populate("department", departments);
populate("level", levels);
populate("semester", semesters);
populate("committee", committees);

/* ========= ELEMENTS ========= */

const form = document.getElementById("summitForm");
const status = document.getElementById("status");

const studentName = document.getElementById("studentName");
const usn = document.getElementById("usn");
const department = document.getElementById("department");
const specialization = document.getElementById("specialization");
const level = document.getElementById("level");
const semester = document.getElementById("semester");
const committee = document.getElementById("committee");

/* ========= LIVE UPPERCASE ========= */

specialization.addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase();
});

/* ========= FORM SUBMIT (ONLY ONE) ========= */

form.addEventListener("submit", (e) => {
  e.preventDefault();

  if (
    !studentName.value ||
    !usn.value ||
    !department.value ||
    !specialization.value ||
    !level.value ||
    !semester.value ||
    !committee.value
  ) {
    alert("Please fill all required fields");
    return;
  }

  status.innerText = "Getting location...";

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const payload = {
        studentName: studentName.value.trim(),
        usn: usn.value.trim(),
        department: department.value,
        specialization: specialization.value.toUpperCase(),
        level: level.value,
        semester: semester.value,
        committee: committee.value,
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };

      try {
        status.innerText = "Submitting...";

        const res = await fetch("/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (!res.ok) {
          status.innerText = "❌ " + (result.error || "Submission failed");
          return;
        }

        window.location.href = "/success.html";

      } catch (err) {
        status.innerText = "❌ Server error";
      }
    },
    () => {
      status.innerText = "❌ Location permission required";
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});
