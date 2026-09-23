// ---------------------------------------------------------------
// todo.js  —  the Todo page.
//   Create: the "Add" form         Read:   the list + filters
//   Update: check it off / pen     Delete: trash (with Undo)
// ---------------------------------------------------------------
import { mountLayout } from "./layout.js";
import { addTodo, clearCompleted, deleteTodo, findCategory, getState, subscribe, toggleTodo, updateTodo } from "./store.js";
import { categoryChip, confirmDialog, esc, toast } from "./ui.js";

const layout = mountLayout({ page: "todo" });
const main = layout.main;

main.innerHTML = `
  <div class="mx-auto max-w-2xl">
    <div id="head"></div>

    <form id="add-form" class="mt-6 flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-100 p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/30 sm:flex-row sm:items-center">
      <div class="flex grow items-center gap-3 pl-3">
        <i class="fa-regular fa-circle shrink-0 text-base-content/35" aria-hidden="true"></i>
        <input name="text" class="w-full bg-transparent py-2 text-lg outline-none placeholder:text-base-content/40"
          maxlength="120" required autocomplete="off" placeholder="Add a todo" aria-label="Add a todo" />
      </div>
      <div id="add-target" class="flex items-center gap-2"></div>
      <button class="btn btn-primary"><i class="fa-solid fa-plus"></i>Add</button>
    </form>

    <div id="toolbar" class="mt-6 flex flex-wrap items-center justify-between gap-3"></div>
    <ul id="list" class="mt-4 space-y-3"></ul>
  </div>`;

const head = document.getElementById("head");
const addForm = document.getElementById("add-form");
const addTarget = document.getElementById("add-target");
const toolbar = document.getElementById("toolbar");
const list = document.getElementById("list");

let filter = "all"; //      "all" | "active" | "done"
let editingId = null; //    the todo being edited, if any
let query = ""; //          top-bar search text

// ---------------------------------------------------------------
// Reading
// ---------------------------------------------------------------
/** Todos in the selected category (ignores the filter tabs and search). */
function inCategory() {
  const { todos, activeCategory } = getState();
  return todos.filter((t) => activeCategory === "all" || t.categoryId === activeCategory);
}

// ---------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------
function renderHead() {
  const { activeCategory } = getState();
  const category = activeCategory === "all" ? null : findCategory(activeCategory);
  const todos = inCategory();
  const done = todos.filter((t) => t.done).length;
  const percent = todos.length ? Math.round((done / todos.length) * 100) : 0;

  head.innerHTML = `
    <h1 class="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
      ${category ? `<span class="size-3.5 rounded-full" style="background:${category.color}"></span>` : ""}
      ${esc(category?.name ?? "All todos")}
    </h1>
    <div class="mt-3 flex items-center gap-4">
      <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-base-300" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100" aria-label="Completed">
        <div class="h-full rounded-full bg-primary transition-all duration-500" style="width:${percent}%"></div>
      </div>
      <p class="shrink-0 text-sm text-base-content/60"><span class="font-semibold text-base-content">${done}</span> of ${todos.length} done</p>
    </div>`;
}

/** The right side of the add form: a category picker on "All", a hint otherwise. */
function renderAddTarget() {
  const { categories, activeCategory } = getState();
  const previous = addForm.elements.categoryId?.value ?? ""; // keep the user's choice

  if (activeCategory === "all") {
    const stillExists = categories.some((c) => c.id === previous);
    addTarget.innerHTML = `
      <select name="categoryId" class="select select-sm w-full rounded-full sm:w-40" aria-label="Category">
        <option value="">Uncategorized</option>
        ${categories.map((c) => `<option value="${c.id}" ${stillExists && c.id === previous ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
      </select>`;
  } else {
    addTarget.innerHTML = `<span class="hidden text-sm text-base-content/55 sm:inline">Adding to</span>${categoryChip(findCategory(activeCategory))}`;
  }
}

function renderToolbar() {
  const todos = inCategory();
  const counts = {
    all: todos.length,
    active: todos.filter((t) => !t.done).length,
    done: todos.filter((t) => t.done).length,
  };
  const tab = (key, label) => `
    <button data-filter="${key}" aria-pressed="${filter === key}"
      class="rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${filter === key ? "bg-neutral text-neutral-content" : "text-base-content/65 hover:text-base-content"}">
      ${label} <span class="${filter === key ? "text-neutral-content/70" : "text-base-content/45"}">${counts[key]}</span>
    </button>`;

  toolbar.innerHTML = `
    <div class="inline-flex rounded-full border border-base-300 bg-base-100 p-1" role="group" aria-label="Filter todos">
      ${tab("all", "All")}${tab("active", "Active")}${tab("done", "Done")}
    </div>
    ${
      counts.done
        ? '<button data-action="clear-done" class="btn btn-ghost btn-sm text-base-content/70"><i class="fa-solid fa-broom"></i>Clear completed</button>'
        : ""
    }`;
}

function renderList() {
  const { activeCategory } = getState();
  const q = query.toLowerCase();

  const visible = inCategory().filter(
    (t) =>
      (filter === "all" || (filter === "done" ? t.done : !t.done)) && (!q || t.text.toLowerCase().includes(q)),
  );

  if (!visible.length) {
    let icon = "fa-clipboard-check";
    let title = "No todos yet";
    let text = "Add your first one above.";
    if (query) [icon, title, text] = ["fa-magnifying-glass", "Nothing matches your search", "Try a different word."];
    else if (inCategory().length && filter === "active") [icon, title, text] = ["fa-circle-check", "You're all caught up", "Every todo here is done."];
    else if (inCategory().length && filter === "done") [icon, title, text] = ["fa-hourglass-half", "Nothing completed yet", "Check a todo off and it shows up here."];

    list.innerHTML = `
      <li class="rounded-3xl border-2 border-dashed border-base-300 bg-base-100/60 px-6 py-14 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-xl text-primary"><i class="fa-solid ${icon}"></i></span>
        <h3 class="mt-4 font-display text-xl font-semibold">${title}</h3>
        <p class="mt-1 text-base-content/60">${text}</p>
      </li>`;
    return;
  }

  list.innerHTML = visible.map((todo) => todoItem(todo, activeCategory === "all")).join("");
}

function todoItem(todo, showCategory) {
  const category = findCategory(todo.categoryId);
  const editing = editingId === todo.id;
  const { categories } = getState();

  // The colored left edge echoes the active-category border in the sidebar.
  return `
  <li data-id="${todo.id}" class="group flex flex-wrap items-center gap-3 rounded-2xl border border-l-[5px] border-base-300 bg-base-100 py-3 pl-4 pr-3 shadow-sm"
    style="border-left-color:${category?.color ?? "#b8c4c0"}">
    <input type="checkbox" class="checkbox checkbox-primary checkbox-sm rounded-full" ${todo.done ? "checked" : ""}
      aria-label="Mark “${esc(todo.text)}” as ${todo.done ? "not done" : "done"}" />
    ${
      editing
        ? `<form data-form="edit" class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <input name="text" class="input input-sm min-w-40 grow" maxlength="120" required autocomplete="off" aria-label="Edit todo" value="${esc(todo.text)}" />
            <select name="categoryId" class="select select-sm w-36" aria-label="Category">
              <option value="">Uncategorized</option>
              ${categories.map((c) => `<option value="${c.id}" ${c.id === todo.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
            </select>
            <button class="btn btn-primary btn-sm btn-square" aria-label="Save"><i class="fa-solid fa-check"></i></button>
            <button type="button" data-action="cancel-edit" class="btn btn-ghost btn-sm btn-square" aria-label="Cancel"><i class="fa-solid fa-xmark"></i></button>
          </form>`
        : `<span data-todo-text title="Double-click to edit" class="min-w-0 flex-1 break-words text-lg ${todo.done ? "text-base-content/40 line-through" : ""}">${esc(todo.text)}</span>
           ${showCategory ? categoryChip(category, "hidden sm:inline-flex") : ""}
           <div class="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
             <button data-action="edit" class="btn btn-ghost btn-sm btn-circle" aria-label="Edit todo"><i class="fa-solid fa-pen"></i></button>
             <button data-action="delete" class="btn btn-ghost btn-sm btn-circle text-error" aria-label="Delete todo"><i class="fa-solid fa-trash"></i></button>
           </div>`
    }
  </li>`;
}

function render() {
  renderHead();
  renderAddTarget();
  renderToolbar();
  renderList();
}

// ---------------------------------------------------------------
// Events
// ---------------------------------------------------------------

// CREATE
addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(addForm);
  const text = data.get("text").trim();
  if (!text) return;

  const { activeCategory } = getState();
  if (filter === "done") filter = "all"; // otherwise the new todo would be hidden
  addTodo({ text, categoryId: activeCategory === "all" ? data.get("categoryId") : activeCategory });
  addForm.elements.text.value = "";
  addForm.elements.text.focus();
  toast("Todo added");
});

// UPDATE (tick)
list.addEventListener("change", (event) => {
  if (event.target.matches("input[type=checkbox]")) toggleTodo(event.target.closest("li").dataset.id);
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
      toast("Todo deleted", { undo, icon: "fa-trash" });
      break;
    }
  }
});

// UPDATE (text + category)
list.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = event.target.closest("li").dataset.id;
  const data = new FormData(event.target);
  const text = data.get("text").trim();
  if (!text) return;

  editingId = null;
  updateTodo(id, { text, categoryId: data.get("categoryId") || null });
  toast("Todo updated");
});

list.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editingId) {
    editingId = null;
    renderList();
  }
});

// Double-clicking the text is a shortcut for the pen button.
list.addEventListener("dblclick", (event) => {
  const text = event.target.closest("[data-todo-text]");
  if (!text) return;
  editingId = text.closest("li").dataset.id;
  renderList();
  list.querySelector(`[data-id="${editingId}"] input[name=text]`)?.select();
});

toolbar.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-filter]");
  if (tab) {
    filter = tab.dataset.filter;
    renderToolbar();
    renderList();
    return;
  }

  if (event.target.closest("[data-action=clear-done]")) {
    const { activeCategory } = getState();
    const count = inCategory().filter((t) => t.done).length;
    confirmDialog({
      title: "Clear completed todos?",
      message: `${count} finished todo${count === 1 ? "" : "s"} will be deleted.`,
      confirmLabel: "Clear completed",
      onConfirm: () => {
        clearCompleted(activeCategory);
        toast("Cleared completed todos");
      },
    });
  }
});

// ---------------------------------------------------------------
// Keep the page in sync with the store
// ---------------------------------------------------------------
subscribe(render);
layout.onSearch((text) => {
  query = text;
  renderList();
});

render();
