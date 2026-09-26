// ---------------------------------------------------------------
// sidebar.js — behavior for the sidebar and top bar that is already
// present as real HTML in index.html / todo.html. This file does not
// build any markup; it clones the category <li> template, fills in
// text, and wires up clicks.
// ---------------------------------------------------------------
import "@fortawesome/fontawesome-free/css/all.min.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource-variable/figtree";
import "./style.css";

import {
  CATEGORY_COLORS,
  addCategory,
  deleteCategory,
  findCategory,
  getState,
  logout,
  setUser,
  updateCategory,
} from "./store.js";
import { clone, confirmDialog, fillAvatar, openModal, toast } from "./dom.js";

const catList = document.getElementById("cat-list");
const catSearchInput = document.getElementById("cat-search");
const userCard = document.getElementById("user-card");
const searchInput = document.getElementById("search");
const searchWrap = document.getElementById("search-wrap");
const searchToggle = document.getElementById("search-toggle");

let activeCategory = "all";
let onCategoryChange = () => {};
let countForCategory = () => 0; // page-specific: posts count or open-todos count

/** Call once on page load. countFn(categoryId) should return the number to show beside each category. */
export function initSidebar({ onChange, countFn }) {
  onCategoryChange = onChange;
  countForCategory = countFn;

  renderCategories();
  renderUser();
  ensureUser();
  wireCategoryList();
  wireCategoryAdd();
  wireSearchToggle();
  wireUserCardClicks();
}

export function setActiveCategoryId(id) {
  activeCategory = id;
}
export const getActiveCategoryId = () => activeCategory;

/** Re-draw counts + the "All" row (call after posts/todos change). */
export function refreshCounts() {
  document.querySelector('[data-count="all"]').textContent = countForCategory("all");
  catList.querySelectorAll("[data-cat]:not([data-cat='all'])").forEach((btn) => {
    btn.parentElement.querySelector('[data-role="count"]').textContent = countForCategory(btn.dataset.cat);
  });
}

// ---------------------------------------------------------------
// Category list
// ---------------------------------------------------------------
function renderCategories() {
  const { categories } = getState();
  const query = catSearchInput.value.trim().toLowerCase();

  catList.querySelectorAll("li[data-generated]").forEach((li) => li.remove());

  categories
    .filter((c) => c.name.toLowerCase().includes(query))
    .forEach((category) => {
      const li = clone("category-item-template");
      li.dataset.generated = "true";
      const button = li.querySelector("[data-cat]");
      button.dataset.cat = category.id;
      button.querySelector('[data-role="dot"]').style.background = category.color;
      button.querySelector('[data-role="name"]').textContent = category.name;
      button.querySelector('[data-role="count"]').textContent = countForCategory(category.id);
      catList.append(li);
    });

  // "All" row visibility follows the same search
  document.querySelector('[data-cat="all"]').closest("li").classList.toggle("hidden", !"all".includes(query) && query !== "");
  syncActiveHighlight();
}

function syncActiveHighlight() {
  catList.querySelectorAll("[data-cat]").forEach((btn) => {
    const active = btn.dataset.cat === activeCategory;
    btn.classList.toggle("border-marigold", active);
    btn.classList.toggle("bg-white/10", active);
    btn.classList.toggle("font-medium", active);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("border-transparent", !active);
    btn.setAttribute("aria-current", active ? "true" : "false");
  });
}

function wireCategoryList() {
  catSearchInput.addEventListener("input", renderCategories);

  catList.addEventListener("click", (event) => {
    const select = event.target.closest("[data-cat]");
    const edit = event.target.closest('[data-action="edit-cat"]');
    const del = event.target.closest('[data-action="delete-cat"]');

    if (select) {
      activeCategory = select.dataset.cat;
      syncActiveHighlight();
      onCategoryChange(activeCategory);
      document.getElementById("drawer").checked = false; // close on phones
    } else if (edit) {
      openCategoryModal(findCategory(edit.closest("li").querySelector("[data-cat]").dataset.cat));
    } else if (del) {
      const category = findCategory(del.closest("li").querySelector("[data-cat]").dataset.cat);
      confirmDialog({
        title: `Delete "${category.name}"?`,
        message: "Its posts and todos are kept. They move to Uncategorized.",
        confirmLabel: "Delete category",
        onConfirm: () => {
          deleteCategory(category.id);
          if (activeCategory === category.id) {
            activeCategory = "all";
            onCategoryChange(activeCategory);
          }
          renderCategories();
          refreshCounts();
          toast(`Deleted "${category.name}"`);
        },
      });
    }
  });
}

function wireCategoryAdd() {
  document.getElementById("cat-add").addEventListener("click", () => openCategoryModal(null));
}

function openCategoryModal(category) {
  const editing = Boolean(category);
  const color = category?.color ?? CATEGORY_COLORS[getState().categories.length % CATEGORY_COLORS.length];

  const dialog = openModal("category-form-template", { width: "max-w-md" });
  dialog.querySelector('[data-role="modal-title"]').textContent = editing ? "Edit category" : "New category";
  dialog.querySelector('[data-role="submit-btn"]').lastChild.textContent = editing ? "Save changes" : "Add category";
  dialog.querySelector("input[name=name]").value = category?.name ?? "";

  const swatches = dialog.querySelector('[data-role="swatches"]');
  CATEGORY_COLORS.forEach((c) => {
    const label = clone("swatch-template");
    const input = label.querySelector("input");
    input.value = c;
    if (c === color) input.checked = true;
    label.querySelector('[data-role="swatch"]').style.background = c;
    swatches.append(label);
  });

  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const values = { name: data.get("name").trim(), color: data.get("color") };
    if (!values.name) return;

    if (editing) {
      updateCategory(category.id, values);
      renderCategories();
      refreshCounts();
      toast("Category updated");
    } else {
      const created = addCategory(values);
      activeCategory = created.id;
      renderCategories();
      refreshCounts();
      onCategoryChange(activeCategory);
      toast(`Added "${created.name}"`);
    }
    dialog.close();
  });
}

// ---------------------------------------------------------------
// User card + welcome prompt
// ---------------------------------------------------------------
function renderUser() {
  const { user } = getState();
  fillAvatar(userCard.querySelector('[data-role="avatar"]') ?? buildUserCard(), user ?? "?");
  userCard.querySelector('[data-role="name"]').textContent = user ?? "Guest";
}

/** The user card has no fixed markup in the HTML (it's tiny + dynamic), so we build it once from parts already in userCard's template-like structure. */
function buildUserCard() {
  userCard.innerHTML = "";
  const avatar = document.createElement("span");
  avatar.dataset.role = "avatar";
  avatar.className = "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white";

  const info = document.createElement("div");
  info.className = "min-w-0 flex-1";
  const name = document.createElement("p");
  name.dataset.role = "name";
  name.className = "truncate font-medium text-white";
  const status = document.createElement("p");
  status.className = "text-xs text-pine-muted";
  status.textContent = "Signed in";
  info.append(name, status);

  const logoutBtn = document.createElement("button");
  logoutBtn.id = "logout-btn";
  logoutBtn.className = "btn btn-ghost btn-sm btn-square text-pine-text hover:bg-white/10";
  logoutBtn.setAttribute("aria-label", "Log out");
  logoutBtn.title = "Log out";
  logoutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';

  userCard.append(avatar, info, logoutBtn);
  return avatar;
}

function wireUserCardClicks() {
  userCard.addEventListener("click", (event) => {
    if (event.target.closest("#logout-btn")) {
      logout();
      renderUser();
      ensureUser();
      toast("You're logged out", { icon: "fa-hand" });
    }
  });
}

let welcomeDialog = null;
function ensureUser() {
  if (getState().user || welcomeDialog) return;

  welcomeDialog = openModal("welcome-template", { dismissible: false, width: "max-w-sm" });
  welcomeDialog.addEventListener("close", () => (welcomeDialog = null));
  welcomeDialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = new FormData(event.target).get("name").trim();
    if (!name) return;
    setUser(name);
    renderUser();
    welcomeDialog.close();
  });
}

// ---------------------------------------------------------------
// Top-bar search toggle (the input itself is wired by each page)
// ---------------------------------------------------------------
function wireSearchToggle() {
  function setOpen(open) {
    searchWrap.classList.toggle("w-0", !open);
    searchWrap.inert = !open;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) searchInput.focus();
  }
  searchToggle.addEventListener("click", () => setOpen(searchWrap.inert));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    searchInput.value = "";
    searchInput.dispatchEvent(new Event("input"));
    setOpen(false);
    searchToggle.focus();
  });
}
