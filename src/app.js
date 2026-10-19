// =================================================================
// app.js — the only JavaScript file in this project.
//
//   - index.html (Todo, the home page) and profile.html contain real,
//     static HTML. This file does not build page layout from strings.
//   - Modals are plain daisyUI <dialog class="modal"> elements already
//     in each page's HTML. Because each has an id, the browser exposes
//     it as a global automatically, so onclick="todo_modal.showModal()"
//     in the markup works with no setup — that's daisyUI's own pattern.
//   - Login/profile is a simple demo: one user record in localStorage,
//     no real backend. Logging in from the header works on either page.
// =================================================================

import "@fortawesome/fontawesome-free/css/all.min.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./style.css";

const STORAGE_KEY = "daybook:v3";

let currentUser = null; // { username, email, password } | null
let pendingDelete = null;
let currentFilter = "all"; // all | active | done
let searchQuery = "";
let nextId = 100;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

// -----------------------------------------------------------------
// Small helpers
// -----------------------------------------------------------------
function toast(message, { undo, icon = "fa-circle-check" } = {}) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2";
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }
  const el = document.createElement("div");
  el.className = "flex items-center gap-3 rounded-xl bg-neutral px-4 py-3 text-sm text-neutral-content shadow-lg";
  el.innerHTML = `<i class="fa-solid ${icon} text-secondary"></i><span></span>`;
  el.querySelector("span").textContent = message;
  if (undo) {
    const btn = document.createElement("button");
    btn.className = "ml-1 font-semibold text-secondary underline-offset-2 hover:underline";
    btn.textContent = "Undo";
    btn.addEventListener("click", () => {
      undo();
      el.remove();
    });
    el.append(btn);
  }
  host.append(el);
  setTimeout(() => el.remove(), undo ? 6000 : 3000);
}

function avatarColor(name) {
  const colors = ["#2f9e8f", "#3e8ede", "#7c6bd6", "#e5677d", "#c98a1b", "#6f8f2a"];
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

// -----------------------------------------------------------------
// Boot
// -----------------------------------------------------------------
function boot() {
  loadFromStorage();
  renderHeaderAuth();
  if ($("#list")) {
    wireSearch();
    refreshTodoList();
  }
  if ($("#profile-form")) {
    renderProfileForm();
  }
}
document.addEventListener("DOMContentLoaded", boot);

// -----------------------------------------------------------------
// Persistence
// -----------------------------------------------------------------
function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function saveToStorage() {
  const existing = readStorage() ?? {};
  const data = {
    user: currentUser,
    nextId,
    // Todos are only overwritten if this page has the list, so saving
    // from the Profile page never wipes the todo data.
    todos: $("#list")
      ? $$("#list .todo-item").map((li) => ({
          id: li.id.replace("todo-", ""),
          text: li.dataset.text,
          done: li.dataset.done === "true",
        }))
      : existing.todos,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromStorage() {
  const data = readStorage();
  if (!data) return;

  currentUser = data.user ?? null;
  nextId = data.nextId ?? nextId;

  if (data.todos && $("#list")) {
    $("#list").innerHTML = "";
    data.todos.forEach((t) => insertTodoRow(t));
  }
}

// -----------------------------------------------------------------
// Header auth (Log in / avatar), login modal
// -----------------------------------------------------------------
function renderHeaderAuth() {
  const host = $("#header-auth");
  if (!host) return;

  if (!currentUser) {
    host.innerHTML = `
      <button class="btn btn-primary btn-sm" onclick="login_modal.showModal()">
        <i class="fa-solid fa-right-to-bracket"></i>Log in
      </button>`;
    return;
  }

  host.innerHTML = `
    <a href="/profile.html" class="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-base-200">
      <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"></span>
      <span class="hidden text-sm font-medium sm:inline"></span>
    </a>
    <button class="btn btn-ghost btn-sm btn-square ml-1" aria-label="Log out" title="Log out" onclick="logout()">
      <i class="fa-solid fa-right-from-bracket"></i>
    </button>`;
  const avatar = host.querySelector("span.inline-flex");
  avatar.textContent = currentUser.username[0].toUpperCase();
  avatar.style.background = avatarColor(currentUser.username);
  host.querySelector("a span:last-child").textContent = currentUser.username;

  // wrap the two elements so they sit inline together
  host.className = "flex items-center";
}

window.submitLogin = function (event) {
  event.preventDefault();
  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) return false;

  // Demo auth: if a profile already exists for this email, "log in" as them;
  // otherwise create a new account on the spot.
  const existing = readStorage()?.user;
  if (existing && existing.email.toLowerCase() === email.toLowerCase()) {
    currentUser = existing;
  } else {
    currentUser = { username: email.split("@")[0], email, password };
  }

  saveToStorage();
  renderHeaderAuth();
  if ($("#profile-form")) renderProfileForm();
  form.reset();
  login_modal.close();
  toast(`Welcome, ${currentUser.username}`);
  return false;
};

window.logout = function () {
  currentUser = null;
  saveToStorage();
  renderHeaderAuth();
  if ($("#profile-form")) renderProfileForm();
  toast("You're logged out", { icon: "fa-hand" });
};

// -----------------------------------------------------------------
// Confirm dialog (shared)
// -----------------------------------------------------------------
function showConfirm({ title, message, confirmLabel, run }) {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-btn").lastChild.textContent = confirmLabel;
  pendingDelete = run;
  confirm_modal.showModal();
}
window.runPendingDelete = function () {
  confirm_modal.close();
  if (pendingDelete) pendingDelete();
  pendingDelete = null;
};

// ===================================================================
// PROFILE PAGE
// ===================================================================
function renderProfileForm() {
  const avatar = $("#profile-avatar");
  const subtitle = $("#profile-subtitle");
  const form = $("#profile-form");

  if (!currentUser) {
    avatar.textContent = "?";
    avatar.style.background = "#5b7a74";
    subtitle.textContent = "Not logged in";
    form.classList.add("opacity-50", "pointer-events-none");
    $("#profile-status").textContent = "Log in from the header to edit your profile.";
    return;
  }

  form.classList.remove("opacity-50", "pointer-events-none");
  avatar.textContent = currentUser.username[0].toUpperCase();
  avatar.style.background = avatarColor(currentUser.username);
  subtitle.textContent = currentUser.email;
  $("#profile-username").value = currentUser.username;
  $("#profile-email").value = currentUser.email;
  $("#profile-password").value = "";
  $("#profile-status").textContent = "";
};

window.submitProfile = function (event) {
  event.preventDefault();
  if (!currentUser) return false;
  const form = event.target;
  const username = form.username.value.trim();
  const email = form.email.value.trim();
  const password = form.password.value;

  if (!username || !email) return false;

  currentUser = {
    username,
    email,
    password: password ? password : currentUser.password,
  };
  saveToStorage();
  renderHeaderAuth();
  renderProfileForm();
  $("#profile-status").textContent = `Saved just now`;
  toast("Profile updated");
  return false;
};

// ===================================================================
// TODO PAGE (home page)
// ===================================================================
function visibleTodos() {
  const q = searchQuery;
  return $$("#list .todo-item").filter((li) => {
    const done = li.dataset.done === "true";
    const inFilter = currentFilter === "all" || (currentFilter === "done" ? done : !done);
    const inSearch = !q || li.dataset.text.toLowerCase().includes(q);
    return inFilter && inSearch;
  });
}

function wireSearch() {
  const input = $("#search");
  if (!input) return;
  input.addEventListener("input", () => {
    searchQuery = input.value.trim().toLowerCase();
    refreshTodoList();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    input.value = "";
    searchQuery = "";
    refreshTodoList();
  });
}

function refreshTodoList() {
  const all = $$("#list .todo-item");
  const visible = visibleTodos();
  all.forEach((li) => li.classList.toggle("hidden", !visible.includes(li)));

  const empty = $("#list-empty");
  empty.classList.toggle("hidden", visible.length > 0);
  if (visible.length === 0) {
    let icon = "fa-clipboard-check", title = "No todos yet", text = "Add your first one above.";
    if (searchQuery) [icon, title, text] = ["fa-magnifying-glass", "Nothing matches your search", "Try a different word."];
    else if (all.length && currentFilter === "active") [icon, title, text] = ["fa-circle-check", "You're all caught up", "Every todo here is done."];
    else if (all.length && currentFilter === "done") [icon, title, text] = ["fa-hourglass-half", "Nothing completed yet", "Check a todo off and it shows up here."];
    $("#list-empty-icon").className = `fa-solid ${icon}`;
    $("#list-empty-title").textContent = title;
    $("#list-empty-text").textContent = text;
  }

  const done = all.filter((li) => li.dataset.done === "true").length;
  const percent = all.length ? Math.round((done / all.length) * 100) : 0;
  $("#progress-bar").style.width = `${percent}%`;
  $("#progress-track").setAttribute("aria-valuenow", percent);
  $("#progress-done").textContent = done;
  $("#progress-total").textContent = all.length;

  $("#count-all").textContent = all.length;
  $("#count-active").textContent = all.length - done;
  $("#count-done").textContent = done;
  $("#clear-done-btn").classList.toggle("hidden", done === 0);
}

window.setFilter = function (filter) {
  currentFilter = filter;
  $$(".filter-btn").forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.setAttribute("aria-pressed", String(active));
    btn.classList.toggle("bg-neutral", active);
    btn.classList.toggle("text-neutral-content", active);
    btn.classList.toggle("text-base-content/65", !active);
    const span = btn.querySelector("span");
    span.classList.toggle("text-neutral-content/70", active);
    span.classList.toggle("text-base-content/45", !active);
  });
  refreshTodoList();
};

window.submitAddTodo = function (event) {
  event.preventDefault();
  const form = event.target;
  const text = form.text.value.trim();
  if (!text) return false;

  const id = `t${nextId++}`;
  const li = insertTodoRow({ id, text, done: false });
  $("#list").prepend(li);
  if (currentFilter === "done") window.setFilter("all");

  form.reset();
  form.text.focus();
  refreshTodoList();
  saveToStorage();
  toast("Todo added");
  return false;
};

window.toggleTodo = function (id) {
  const li = $(`#todo-${id}`);
  const done = li.dataset.done !== "true";
  li.dataset.done = String(done);
  li.querySelector('input[type="checkbox"]').checked = done;
  const text = li.querySelector(".todo-text");
  text.classList.toggle("text-base-content/40", done);
  text.classList.toggle("line-through", done);
  li.querySelector('input[type="checkbox"]').setAttribute("aria-label", `Mark "${li.dataset.text}" as ${done ? "not done" : "done"}`);
  refreshTodoList();
  saveToStorage();
};

window.editTodo = function (id) {
  const li = $(`#todo-${id}`);
  const form = todo_modal.querySelector("form");
  form.todoId.value = id;
  form.text.value = li.dataset.text;
  todo_modal.showModal();
};

window.submitTodoEdit = function (event) {
  event.preventDefault();
  const form = event.target;
  const id = form.todoId.value;
  const text = form.text.value.trim();
  if (!text) return false;

  const li = $(`#todo-${id}`);
  li.dataset.text = text;
  li.querySelector(".todo-text").textContent = text;

  refreshTodoList();
  saveToStorage();
  toast("Todo updated");
  todo_modal.close();
  return false;
};

window.confirmDeleteTodo = function (id, text) {
  showConfirm({
    title: "Delete this todo?",
    message: `"${text}" will be deleted.`,
    confirmLabel: "Delete todo",
    run: () => {
      const li = $(`#todo-${id}`);
      const next = li.nextSibling;
      const parent = li.parentElement;
      li.remove();
      refreshTodoList();
      saveToStorage();
      toast("Todo deleted", {
        icon: "fa-trash",
        undo: () => {
          parent.insertBefore(li, next);
          refreshTodoList();
          saveToStorage();
        },
      });
    },
  });
};

window.confirmClearCompleted = function () {
  const doneCount = $$("#list .todo-item").filter((li) => li.dataset.done === "true").length;
  if (doneCount === 0) return;
  showConfirm({
    title: "Clear completed todos?",
    message: `${doneCount} finished todo${doneCount === 1 ? "" : "s"} will be deleted.`,
    confirmLabel: "Clear completed",
    run: () => {
      $$("#list .todo-item")
        .filter((li) => li.dataset.done === "true")
        .forEach((li) => li.remove());
      refreshTodoList();
      saveToStorage();
      toast("Cleared completed todos");
    },
  });
};

/** Builds one <li> from data, wires its events, appends it to #list unless it already exists. Returns the element. */
function insertTodoRow(t) {
  const li = document.createElement("li");
  li.id = `todo-${t.id}`;
  li.className = "todo-item group flex flex-wrap items-center gap-3 rounded-2xl border border-base-300 bg-base-100 py-3 pl-4 pr-3 shadow-sm";
  li.dataset.done = String(Boolean(t.done));
  li.dataset.text = t.text;

  li.innerHTML = `
    <input type="checkbox" class="checkbox checkbox-primary checkbox-sm rounded-full" ${t.done ? "checked" : ""} />
    <span class="min-w-0 flex-1 break-words text-lg todo-text ${t.done ? "text-base-content/40 line-through" : ""}" title="Double-click to edit"></span>
    <div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button class="btn btn-ghost btn-sm btn-circle" aria-label="Edit todo"><i class="fa-solid fa-pen"></i></button>
      <button class="btn btn-ghost btn-sm btn-circle text-error" aria-label="Delete todo"><i class="fa-solid fa-trash"></i></button>
    </div>`;

  li.querySelector(".todo-text").textContent = t.text;
  li.querySelector('input[type="checkbox"]').addEventListener("change", () => window.toggleTodo(t.id));
  li.querySelector(".todo-text").addEventListener("dblclick", () => window.editTodo(t.id));
  const [editBtn, delBtn] = li.querySelectorAll(".flex.gap-0\\.5 button");
  editBtn.addEventListener("click", () => window.editTodo(t.id));
  delBtn.addEventListener("click", () => window.confirmDeleteTodo(t.id, t.text));

  if (!document.getElementById(`todo-${t.id}`)) $("#list").append(li);
  return li;
}
