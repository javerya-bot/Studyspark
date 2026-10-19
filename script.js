
"use strict";

// StudySpark - Student productivity demo project.
// All data is stored locally in this browser.

const STORAGE_KEY = "studyspark-demo-v1";

const $ = (selector) => document.querySelector(selector);

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (!saved || typeof saved !== "object") {
      return {};
    }

    return saved;
  } catch (error) {
    console.warn("StudySpark could not read saved data.", error);
    return {};
  }
}

const savedData = loadData();
const today = getToday();

const state = {
  tasks: Array.isArray(savedData.tasks)
    ? savedData.tasks.filter(
        (task) =>
          task &&
          typeof task.id === "string" &&
          typeof task.text === "string" &&
          typeof task.done === "boolean"
      )
    : [],

  notes: typeof savedData.notes === "string"
    ? savedData.notes.slice(0, 5000)
    : "",

  goal: Number.isFinite(savedData.goal)
    ? Math.min(600, Math.max(5, savedData.goal))
    : 60,

  focusDate: savedData.focusDate === today
    ? today
    : today,

  focusMinutes: savedData.focusDate === today &&
      Number.isFinite(savedData.focusMinutes)
    ? Math.max(0, savedData.focusMinutes)
    : 0
};

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn("StudySpark could not save data.", error);
    return false;
  }
}

// -------------------- DATE & STATISTICS --------------------

$("#todayDate").textContent = new Date().toLocaleDateString(
  "en-US",
  {
    weekday: "long",
    month: "long",
    day: "numeric"
  }
);

function renderStats() {
  const completed = state.tasks.filter((task) => task.done).length;
  const total = state.tasks.length;
  const percent = Math.min(
    100,
    Math.round((state.focusMinutes / state.goal) * 100)
  );

  $("#completedStat").innerHTML =
    `${completed} <span>/ ${total}</span>`;

  $("#focusStat").innerHTML =
    `${state.focusMinutes} <span>min</span>`;

  $("#goalStat").innerHTML = `${percent}<span>%</span>`;

  $("#goalProgressBar").style.width = `${percent}%`;
  $("#goalProgressText").textContent =
    `${state.focusMinutes} of ${state.goal} min`;
  $("#goalPercent").textContent = `${percent}%`;

  $("#goalInput").value = state.goal;
}

// -------------------- TASK MANAGER --------------------

let currentFilter = "all";

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function renderTasks() {
  const list = $("#taskList");
  list.replaceChildren();

  const visibleTasks = state.tasks.filter((task) => {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "done") return task.done;
    return true;
  });

  $("#emptyTasks").hidden = visibleTasks.length > 0;
  $("#emptyTasks").textContent =
    currentFilter === "all"
      ? "No tasks here yet. Add your first goal!"
      : currentFilter === "active"
        ? "All caught up! No pending tasks."
        : "No completed tasks yet. Keep going!";

  visibleTasks.forEach((task) => {
    const item = document.createElement("li");
    item.className = `task-item${task.done ? " completed" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", `Complete ${task.text}`);

    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      saveData();
      renderTasks();
      renderStats();
    });

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = task.text;

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-task";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${task.text}`);

    deleteButton.addEventListener("click", () => {
      state.tasks = state.tasks.filter((entry) => entry.id !== task.id);
      saveData();
      renderTasks();
      renderStats();
    });

    item.append(checkbox, text, deleteButton);
    list.append(item);
  });

  const completed = state.tasks.filter((task) => task.done).length;
  const total = state.tasks.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("#taskCount").textContent = `${total} task${total === 1 ? "" : "s"}`;
  $("#taskProgressLabel").textContent = `${percent}%`;
  $("#taskProgressBar").style.width = `${percent}%`;
}

$("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const input = $("#taskInput");
  const text = input.value.trim();

  if (!text) {
    input.focus();
    return;
  }

  state.tasks.unshift({
    id: createId(),
    text,
    done: false
  });

  saveData();
  currentFilter = "all";

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.classList.toggle("selected", button.dataset.filter === "all");
  });

  renderTasks();
  renderStats();

  input.value = "";
  input.focus();
});

document.querySelectorAll(".filter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;

    document.querySelectorAll(".filter-btn").forEach((filterButton) => {
      filterButton.classList.toggle(
        "selected",
        filterButton === button
      );
    });

    renderTasks();
  });
});

// -------------------- POMODORO FOCUS TIMER --------------------

let selectedMinutes = 25;
let remainingSeconds = selectedMinutes * 60;
let timerInterval = null;
let timerRunning = false;
let isBreak = false;

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function renderTimer() {
  $("#timerDisplay").textContent = formatTime(remainingSeconds);
  $("#timerMode").textContent = isBreak ? "BREAK TIME" : "FOCUS TIME";
  $("#timerHint").textContent = isBreak
    ? "Take a little breather"
    : "One thing at a time";

  $("#startTimer").textContent = timerRunning
    ? "Ⅱ Pause"
    : "▶ Start focus";

  const totalSeconds = selectedMinutes * 60;
  const progress = totalSeconds > 0
    ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100
    : 0;

  const angle = Math.min(360, Math.max(0, progress * 3.6));

  $("#timerRing").style.background =
    `conic-gradient(from -90deg, #62baff 0deg, #8c8bff ${angle}deg, #263c64 ${angle}deg, #263c64 360deg)`;

  document.title = timerRunning
    ? `${formatTime(remainingSeconds)} | StudySpark`
    : "StudySpark | Your Study Space";
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
}

function finishTimer() {
  stopTimer();
  remainingSeconds = 0;
  renderTimer();

  if (isBreak) {
    $("#timerMessage").textContent = "Break finished. Ready to focus again?";
  } else {
    state.focusMinutes += selectedMinutes;
    saveData();
    renderStats();

    $("#timerMessage").textContent =
      `Session complete! ${selectedMinutes} focus minutes added. Great work!`;
  }

  // A completed session stays at 00:00 until reset or a new preset is chosen.
  $("#startTimer").textContent = "↻ Start again";
}

function tickTimer() {
  if (remainingSeconds > 0) {
    remainingSeconds -= 1;
    renderTimer();
  }

  if (remainingSeconds <= 0) {
    finishTimer();
  }
}

$("#startTimer").addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    $("#timerMessage").textContent = "Timer paused. Resume whenever you're ready.";
    renderTimer();
    return;
  }

  if (remainingSeconds <= 0) {
    remainingSeconds = selectedMinutes * 60;
  }

  timerRunning = true;
  $("#timerMessage").textContent = isBreak
    ? "Enjoy your break."
    : "You're in focus mode. You've got this!";

  renderTimer();
  timerInterval = setInterval(tickTimer, 1000);
});

$("#resetTimer").addEventListener("click", () => {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  $("#timerMessage").textContent = "Timer reset. Ready when you are.";
  renderTimer();
});

document.querySelectorAll(".preset").forEach((button) => {
  button.addEventListener("click", () => {
    stopTimer();

    selectedMinutes = Number(button.dataset.minutes);
    isBreak = selectedMinutes === 5;
    remainingSeconds = selectedMinutes * 60;

    document.querySelectorAll(".preset").forEach((preset) => {
      preset.classList.toggle("active", preset === button);
    });

    $("#timerMessage").textContent = isBreak
      ? "A short break is ready."
      : `${selectedMinutes} minutes set. Let's focus.`;

    renderTimer();
  });
});

// -------------------- QUICK NOTES --------------------

$("#notesInput").value = state.notes;

function renderNotesCount() {
  $("#notesCount").textContent =
    `${$("#notesInput").value.length} / 5000 characters`;
}

$("#notesInput").addEventListener("input", () => {
  state.notes = $("#notesInput").value.slice(0, 5000);
  renderNotesCount();

  const saved = saveData();

  $("#notesStatus").textContent = saved
    ? "Saved in this browser"
    : "Could not save — check browser storage";
});

renderNotesCount();

// -------------------- DAILY GOAL --------------------

$("#saveGoal").addEventListener("click", () => {
  const input = $("#goalInput");
  const value = Number(input.value);

  if (!Number.isFinite(value) || value < 5 || value > 600) {
    $("#timerMessage").textContent =
      "Daily goal must be between 5 and 600 minutes.";
    input.value = state.goal;
    return;
  }

  state.goal = Math.round(value);
  saveData();
  renderStats();

  $("#timerMessage").textContent =
    `Daily focus goal saved: ${state.goal} minutes.`;
});

// -------------------- SIDEBAR NAVIGATION --------------------

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach((item) => {
      item.classList.toggle("active", item === link);
    });
  });
});

// -------------------- INITIAL RENDER --------------------

renderTasks();
renderStats();
renderTimer();
saveData();
