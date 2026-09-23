// ---------------------------------------------------------------
// layout.js  —  the shell shared by both pages:
//   sidebar (categories + user) and the top bar (tabs + search).
// Each page calls mountLayout() and gets back the <main> element to fill.
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
  setActiveCategory,
  setUser,
  subscribe,
  updateCategory,
} from "./store.js";
import { avatar, confirmDialog, esc, openModal, toast } from "./ui.js";

/** page is "posts" or "todo" */
export function mountLayout({ page }) {
  const isPosts = page === "posts";
  document.title = isPosts ? "Posts · Daybook" : "Todo · Daybook";

  document.getElementById("app").innerHTML = `
  <div class="drawer lg:drawer-open">
    <input id="drawer" type="checkbox" class="drawer-toggle" />

    <!-- ========== MAIN COLUMN ========== -->
    <div class="drawer-content flex min-h-dvh min-w-0 flex-col">
      <header class="sticky top-0 z-20 flex h-16 items-end justify-between border-b border-base-300 bg-base-100/85 px-3 backdrop-blur sm:px-8">
        <div class="flex items-end">
          <label for="drawer" class="btn btn-ghost btn-square mb-1.5 mr-1 lg:hidden" aria-label="Open menu">
            <i class="fa-solid fa-bars"></i>
          </label>
          <nav class="flex items-end" aria-label="Pages">
            ${tab("/", "fa-newspaper", "Posts", isPosts)}
            ${tab("/todo.html", "fa-list-check", "Todo", !isPosts)}
          </nav>
        </div>

        <div class="mb-2 flex items-center">
          <div id="search-wrap" class="w-0 overflow-hidden transition-[width] duration-300" inert>
            <input id="search" type="search" class="input input-sm w-full rounded-full"
              placeholder="${isPosts ? "Search posts" : "Search todos"}" aria-label="Search" />
          </div>
          <button id="search-toggle" class="btn btn-ghost btn-circle" aria-label="Search" aria-expanded="false">
            <i class="fa-solid fa-magnifying-glass"></i>
          </button>
        </div>
      </header>

      <main id="page" class="flex-1 px-4 py-8 sm:px-10 sm:py-10"></main>
    </div>

    <!-- ========== SIDEBAR ========== -->
    <div class="drawer-side z-30 sidebar-wrap">
      <label for="drawer" aria-label="Close menu" class="drawer-overlay"></label>
      <aside class="sidebar flex h-full w-72 flex-col bg-pine-950 text-pine-text">
        <a href="/" class="flex items-center gap-3 px-6 pb-4 pt-6">
          <span class="grid size-10 place-items-center rounded-xl bg-marigold text-pine-950"><i class="fa-solid fa-book-open"></i></span>
          <span class="font-display text-2xl font-semibold text-white">Daybook</span>
        </a>

        <div class="px-6">
          <label class="input w-full rounded-xl border-white/10 bg-white/10 text-white focus-within:border-marigold focus-within:outline-none">
            <i class="fa-solid fa-magnifying-glass text-pine-muted"></i>
            <input id="cat-search" type="search" class="placeholder:text-pine-muted" placeholder="Search categories" aria-label="Search categories" />
          </label>
        </div>

        <div class="mx-6 my-5 h-px bg-white/10"></div>

        <div class="mb-2 flex items-center justify-between px-6">
          <h2 class="text-sm font-semibold text-pine-muted">Categories</h2>
          <button id="cat-add" class="btn btn-ghost btn-xs btn-circle text-pine-text hover:bg-white/10" aria-label="Add category" title="Add category">
            <i class="fa-solid fa-plus"></i>
          </button>
        </div>

        <ul id="cat-list" class="flex-1 space-y-1 overflow-y-auto pr-4"></ul>

        <div id="user-card" class="m-4 flex items-center gap-3 rounded-2xl bg-white/5 p-3"></div>
      </aside>
    </div>
  </div>`;

  const $ = (selector) => document.querySelector(selector);
  const drawer = $("#drawer");

  // ------------------------------------------------------------
  // Categories (sidebar)
  // ------------------------------------------------------------
  function renderCategories() {
    const { categories, activeCategory, posts, todos } = getState();
    const query = $("#cat-search").value.trim().toLowerCase();

    // The number beside each category: posts on the Posts page, open todos on the Todo page.
    const items = isPosts ? posts : todos.filter((t) => !t.done);
    const countFor = (id) => items.filter((i) => id === "all" || i.categoryId === id).length;

    const rows = [{ id: "all", name: "All", color: null }, ...categories].filter(
      (c) => c.id === "all" || c.name.toLowerCase().includes(query),
    );

    $("#cat-list").innerHTML =
      rows
        .map((c) => {
          const active = c.id === activeCategory;
          const isAll = c.id === "all";
          return `
        <li class="group relative">
          <button data-cat="${c.id}" ${active ? 'aria-current="true"' : ""}
            class="flex w-full items-center gap-3 rounded-r-xl border-l-4 py-2.5 pl-5 pr-3 text-left transition-colors
            ${active ? "border-marigold bg-white/10 font-medium text-white" : "border-transparent hover:bg-white/5"}">
            ${
              isAll
                ? '<i class="fa-solid fa-layer-group w-2.5 text-center text-pine-muted"></i>'
                : `<span class="size-2.5 shrink-0 rounded-full" style="background:${c.color}"></span>`
            }
            <span class="flex-1 truncate">${esc(c.name)}</span>
            <span class="text-xs tabular-nums text-pine-muted transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 pointer-coarse:opacity-0">${countFor(c.id)}</span>
          </button>
          ${
            isAll
              ? ""
              : `<div class="absolute right-2 top-1/2 flex -translate-y-1/2 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
              <button data-edit-cat="${c.id}" class="btn btn-ghost btn-xs btn-circle text-pine-text hover:bg-white/10" aria-label="Rename ${esc(c.name)}"><i class="fa-solid fa-pen"></i></button>
              <button data-del-cat="${c.id}" class="btn btn-ghost btn-xs btn-circle text-pine-text hover:bg-error/40 hover:text-white" aria-label="Delete ${esc(c.name)}"><i class="fa-solid fa-trash"></i></button>
            </div>`
          }
        </li>`;
        })
        .join("") ||
      '<li class="px-6 py-3 text-sm text-pine-muted">No category matches your search.</li>';
  }

  $("#cat-search").addEventListener("input", renderCategories);

  $("#cat-list").addEventListener("click", (event) => {
    const select = event.target.closest("[data-cat]");
    const edit = event.target.closest("[data-edit-cat]");
    const remove = event.target.closest("[data-del-cat]");

    if (select) {
      setActiveCategory(select.dataset.cat);
      drawer.checked = false; // close the drawer on phones
    } else if (edit) {
      openCategoryModal(findCategory(edit.dataset.editCat));
    } else if (remove) {
      const category = findCategory(remove.dataset.delCat);
      confirmDialog({
        title: `Delete “${category.name}”?`,
        message: "Its posts and todos are kept. They move to Uncategorized.",
        confirmLabel: "Delete category",
        onConfirm: () => {
          deleteCategory(category.id);
          toast(`Deleted “${category.name}”`);
        },
      });
    }
  });

  $("#cat-add").addEventListener("click", () => openCategoryModal(null));

  /** One modal for both "add" (category = null) and "edit". */
  function openCategoryModal(category) {
    const editing = Boolean(category);
    const color = category?.color ?? CATEGORY_COLORS[getState().categories.length % CATEGORY_COLORS.length];

    const dialog = openModal(
      `<form class="p-6">
        <h3 class="font-display text-xl font-semibold">${editing ? "Edit category" : "New category"}</h3>

        <label class="mt-5 block">
          <span class="mb-1.5 block text-sm font-medium">Name</span>
          <input name="name" class="input w-full" maxlength="24" required placeholder="e.g. Health" value="${esc(category?.name ?? "")}" />
        </label>

        <fieldset class="mt-5">
          <legend class="mb-2 text-sm font-medium">Color</legend>
          <div class="flex flex-wrap gap-3">
            ${CATEGORY_COLORS.map(
              (c) => `
              <label class="group cursor-pointer">
                <input type="radio" name="color" value="${c}" class="peer sr-only" ${c === color ? "checked" : ""} />
                <span class="grid size-9 place-items-center rounded-full ring-offset-2 transition peer-checked:ring-2 peer-checked:ring-base-content peer-focus-visible:ring-2 peer-focus-visible:ring-primary" style="background:${c}">
                  <i class="fa-solid fa-check text-sm text-white opacity-0 group-has-[:checked]:opacity-100"></i>
                </span>
              </label>`,
            ).join("")}
          </div>
        </fieldset>

        <div class="mt-7 flex justify-end gap-2">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button class="btn btn-primary"><i class="fa-solid fa-check"></i>${editing ? "Save changes" : "Add category"}</button>
        </div>
      </form>`,
      { width: "max-w-md" },
    );

    dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(event.target);
      const values = { name: data.get("name").trim(), color: data.get("color") };
      if (!values.name) return;

      if (editing) {
        updateCategory(category.id, values);
        toast("Category updated");
      } else {
        const created = addCategory(values);
        setActiveCategory(created.id); // jump straight into the new category
        toast(`Added “${created.name}”`);
      }
      dialog.close();
    });
  }

  // ------------------------------------------------------------
  // User card + the "what's your name?" prompt (a fake login)
  // ------------------------------------------------------------
  function renderUser() {
    const { user } = getState();
    $("#user-card").innerHTML = `
      ${avatar(user ?? "?", "size-10")}
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-white">${esc(user ?? "Guest")}</p>
        <p class="text-xs text-pine-muted">Signed in</p>
      </div>
      <button id="logout" class="btn btn-ghost btn-sm btn-square text-pine-text hover:bg-white/10" aria-label="Log out" title="Log out">
        <i class="fa-solid fa-right-from-bracket"></i>
      </button>`;
    $("#logout").addEventListener("click", () => {
      logout();
      toast("You're logged out", { icon: "fa-hand" });
    });
  }

  let nameDialog = null;
  function ensureUser() {
    if (getState().user || nameDialog) return;

    nameDialog = openModal(
      `<form class="p-8 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-marigold text-2xl text-pine-950"><i class="fa-solid fa-book-open"></i></span>
        <h3 class="mt-5 font-display text-2xl font-semibold">Welcome to Daybook</h3>
        <p class="mt-2 text-base-content/70">What should we call you? Your name shows on the posts and comments you write.</p>
        <input name="name" class="input mt-6 w-full text-center" maxlength="24" required autofocus placeholder="Your name" aria-label="Your name" />
        <button class="btn btn-primary mt-4 w-full">Get started</button>
        <p class="mt-4 text-xs text-base-content/50">Demo login. Everything is saved only in this browser.</p>
      </form>`,
      { dismissible: false, width: "max-w-sm" },
    );
    nameDialog.addEventListener("close", () => (nameDialog = null));
    nameDialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      const name = new FormData(event.target).get("name").trim();
      if (!name) return;
      setUser(name);
      nameDialog.close();
    });
  }

  // ------------------------------------------------------------
  // Top-bar search (each page decides what to filter)
  // ------------------------------------------------------------
  const searchCallbacks = [];
  const searchInput = $("#search");
  const searchWrap = $("#search-wrap");
  const searchToggle = $("#search-toggle");

  function setSearchOpen(open) {
    searchWrap.classList.toggle("w-0", !open);
    searchWrap.classList.toggle("w-44", open);
    searchWrap.classList.toggle("sm:w-64", open);
    searchWrap.classList.toggle("mr-1", open);
    searchWrap.inert = !open;
    searchToggle.setAttribute("aria-expanded", String(open));
    if (open) searchInput.focus();
  }

  searchToggle.addEventListener("click", () => setSearchOpen(searchWrap.inert));
  searchInput.addEventListener("input", () => searchCallbacks.forEach((fn) => fn(searchInput.value.trim())));
  searchInput.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    searchInput.value = "";
    searchCallbacks.forEach((fn) => fn(""));
    setSearchOpen(false);
    searchToggle.focus();
  });

  // ------------------------------------------------------------
  // Go!
  // ------------------------------------------------------------
  renderCategories();
  renderUser();
  ensureUser();
  subscribe(() => {
    renderCategories();
    renderUser();
    ensureUser();
  });

  return {
    main: $("#page"),
    onSearch: (fn) => searchCallbacks.push(fn),
    getQuery: () => searchInput.value.trim(),
  };
}

function tab(href, icon, label, active) {
  return `<a href="${href}" ${active ? 'aria-current="page"' : ""}
    class="flex items-center gap-2 border-b-[3px] px-3 pb-3.5 pt-2 font-medium transition-colors sm:px-4
    ${active ? "border-marigold text-base-content" : "border-transparent text-base-content/55 hover:text-base-content"}">
    <i class="fa-solid ${icon}"></i>${label}</a>`;
}
