// ---------------------------------------------------------------
// todo.js — behavior for todo.html.
// Reads the real HTML already on the page and clones #todo-item-template
// for each todo, filling it in with textContent.
// ---------------------------------------------------------------
import { initSidebar, refreshCounts, getActiveCategoryId } from "./sidebar.js";
import { addTodo, clearCompleted, deleteTodo, findCategory, getState, toggleTodo, updateTodo } from "./store.js";
import { clone, confirmDialog, fillCategoryChip, toast } from "./dom.js";

const headTitle = document.getElementById("head-title");
const progressTrack = document.getElementById("progress-track");
const progressBar = document.getElementById("progress-bar");
const progressDone = document.getElementById("progress-done");
const progressTotal = document.getElementById("progress-total");

const addForm = document.getElementById("add-form");
const addTarget = document.getElementById("add-target");

const toolbarButtons = document.querySelectorAll("[data-filter]");
const clearDoneBtn = document.getElementById("clear-done-btn");
const countAll = document.getElementById("count-all");
const countActive = document.getElementById("count-active");
const countDone = document.getElementById("count-done");

const list = document.getElementById("list");
const listEmpty = document.getElementById("list-empty");
const searchInput = document.getElementById("search");

let filter = "all"; // "all" | "active" | "done"
let editingId = null;
let query = "";

// ---------------------------------------------------------------
// Reading
// ---------------------------------------------------------------
function todosInCategory(categoryId) {
  const { todos } = getState();
  return todos.filter((t) => categoryId === "all" || t.categoryId === categoryId);
}
/** Used by the sidebar for its counts: open todos per category. */
function openTodosInCategory(categoryId) {
  return todosInCategory(categoryId).filter((t) => !t.done);
}

// ---------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------
function renderHead() {
  const activeCategory = getActiveCategoryId();
  const category = activeCategory === "all" ? null : findCategory(activeCategory);
  const todos = todosInCategory(activeCategory);
  const done = todos.filter((t) => t.done).length;
  const percent = todos.length ? Math.round((done / todos.length) * 100) : 0;

  headTitle.textContent = category?.name ?? "All todos";
  headTitle.querySelector("span")?.remove();
  if (category) {
    const dot = document.createElement("span");
    dot.className = "size-3.5 rounded-full";
    dot.style.background = category.color;
    headTitle.prepend(dot);
  }

  progressBar.style.width = `${percent}%`;
  progressTrack.setAttribute("aria-valuenow", percent);
  progressDone.textContent = done;
  progressTotal.textContent = todos.length;
}

function renderAddTarget() {
  const { categories } = getState();
  const activeCategory = getActiveCategoryId();
  addTarget.innerHTML = "";

  if (activeCategory === "all") {
    const select = document.createElement("select");
    select.name = "categoryId";
    select.className = "select select-sm w-full rounded-full sm:w-40";
    select.setAttribute("aria-label", "Category");
    select.innerHTML = '<option value="">Uncategorized</option>';
    categories.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = c.name;
      select.append(option);
    });
    addTarget.append(select);
  } else {
    const hint = document.createElement("span");
    hint.className = "hidden text-sm text-base-content/55 sm:inline";
    hint.textContent = "Adding to";
    const chip = buildChipElement(findCategory(activeCategory));
    addTarget.append(hint, chip);
  }
}

function buildChipElement(category) {
  const chip = document.createElement("span");
  chip.className = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";
  fillCategoryChip(chip, category);
  return chip;
}

function renderToolbar() {
  const todos = todosInCategory(getActiveCategoryId());
  const counts = {
    all: todos.length,
    active: todos.filter((t) => !t.done).length,
    done: todos.filter((t) => t.done).length,
  };
  countAll.textContent = counts.all;
  countActive.textContent = counts.active;
  countDone.textContent = counts.done;

  toolbarButtons.forEach((btn) => {
    const active = btn.dataset.filter === filter;
    btn.setAttribute("aria-pressed", String(active));
    btn.classList.toggle("bg-neutral", active);
    btn.classList.toggle("text-neutral-content", active);
    btn.classList.toggle("text-base-content/65", !active);
    const countSpan = btn.querySelector("span");
    countSpan.classList.toggle("text-neutral-content/70", active);
    countSpan.classList.toggle("text-base-content/45", !active);
  });

  clearDoneBtn.classList.toggle("hidden", counts.done === 0);
}

function renderList() {
  const activeCategory = getActiveCategoryId();
  const q = query.toLowerCase();

  const visible = todosInCategory(activeCategory).filter(
    (t) => (filter === "all" || (filter === "done" ? t.done : !t.done)) && (!q || t.text.toLowerCase().includes(q)),
  );

  list.innerHTML = "";
  list.classList.toggle("hidden", visible.length === 0);
  listEmpty.classList.toggle("hidden", visible.length > 0);

  if (visible.length === 0) {
    let icon = "fa-clipboard-check";
    let title = "No todos yet";
    let text = "Add your first one above.";
    if (query) [icon, title, text] = ["fa-magnifying-glass", "Nothing matches your search", "Try a different word."];
    else if (todosInCategory(activeCategory).length && filter === "active") [icon, title, text] = ["fa-circle-check", "You're all caught up", "Every todo here is done."];
    else if (todosInCategory(activeCategory).length && filter === "done") [icon, title, text] = ["fa-hourglass-half", "Nothing completed yet", "Check a todo off and it shows up here."];

    document.getElementById("list-empty-icon").className = `fa-solid ${icon}`;
    document.getElementById("list-empty-title").textContent = title;
    document.getElementById("list-empty-text").textContent = text;
    return;
  }

  visible.forEach((todo) => list.append(buildTodoItem(todo, activeCategory === "all")));
}

function buildTodoItem(todo, showCategory) {
  const li = clone("todo-item-template");
  li.dataset.id = todo.id;
  const category = findCategory(todo.categoryId);
  li.style.borderLeftColor = category?.color ?? "#b8c4c0";

  li.querySelector('[data-role="checkbox"]').checked = todo.done;
  li.querySelector('[data-role="checkbox"]').setAttribute("aria-label", `Mark "${todo.text}" as ${todo.done ? "not done" : "done"}`);

  const textEl = li.querySelector('[data-role="text"]');
  textEl.textContent = todo.text;
  textEl.classList.toggle("text-base-content/40", todo.done);
  textEl.classList.toggle("line-through", todo.done);

  const chip = li.querySelector('[data-role="chip"]');
  if (showCategory) {
    fillCategoryChip(chip, category);
    chip.classList.add("hidden", "sm:inline-flex");
  } else {
    chip.remove();
  }

  const form = li.querySelector('[data-role="edit-form"]');
  if (editingId === todo.id) {
    li.querySelector('[data-role="text"]').hidden = true;
    li.querySelector('[data-role="row-actions"]').hidden = true;
    form.hidden = false;
    form.querySelector("input[name=text]").value = todo.text;
    const select = form.querySelector('[data-role="category-select"]');
    getState().categories.forEach((c) => {
      const option = document.createElement("option");
      option.value = c.id;
      option.textContent = c.name;
      if (c.id === todo.categoryId) option.selected = true;
      select.append(option);
    });
  }

  return li;
}

function render() {
  renderHead();
  renderAddTarget();
  renderToolbar();
  renderList();
  refreshCounts();
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------
addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(addForm);
  const text = data.get("text").trim();
  if (!text) return;

  const activeCategory = getActiveCategoryId();
  if (filter === "done") filter = "all";
  addTodo({ text, categoryId: activeCategory === "all" ? data.get("categoryId") : activeCategory });
  addForm.elements.text.value = "";
  addForm.elements.text.focus();
  render();
  toast("Todo added");
});

list.addEventListener("change", (event) => {
  if (event.target.matches('[data-role="checkbox"]')) {
    toggleTodo(event.target.closest("li").dataset.id);
    render();
  }
});

list.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const id = button.closest("li").dataset.id;

  switch (button.dataset.action) {
    case "edit":
      editingId = id;
      renderList();
      list.querySelector(`[data-id="${id}"] input[name=text]`)?.select();
      break;
    case "cancel-edit":
      editingId = null;
      renderList();
      break;
    case "delete": {
      const undo = deleteTodo(id);
      render();
      toast("Todo deleted", { undo: () => (undo(), render()), icon: "fa-trash" });
      break;
    }
  }
});

list.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = event.target.closest("li").dataset.id;
  const data = new FormData(event.target);
  const text = data.get("text").trim();
  if (!text) return;

  editingId = null;
  updateTodo(id, { text, categoryId: data.get("categoryId") || null });
  render();
  toast("Todo updated");
});

list.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editingId) {
    editingId = null;
    renderList();
  }
});

list.addEventListener("dblclick", (event) => {
  const textEl = event.target.closest("[data-todo-text]");
  if (!textEl) return;
  editingId = textEl.closest("li").dataset.id;
  renderList();
  list.querySelector(`[data-id="${editingId}"] input[name=text]`)?.select();
});

toolbarButtons.forEach((btn) =>
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    renderToolbar();
    renderList();
  }),
);

clearDoneBtn.addEventListener("click", () => {
  const activeCategory = getActiveCategoryId();
  const count = todosInCategory(activeCategory).filter((t) => t.done).length;
  confirmDialog({
    title: "Clear completed todos?",
    message: `${count} finished todo${count === 1 ? "" : "s"} will be deleted.`,
    confirmLabel: "Clear completed",
    onConfirm: () => {
      clearCompleted(activeCategory);
      render();
      toast("Cleared completed todos");
    },
  });
});

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim();
  renderList();
});

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
initSidebar({
  onChange: () => render(),
  countFn: (categoryId) => openTodosInCategory(categoryId).length,
});
render();
