// ---------------------------------------------------------------
// posts.js  —  the Posts page.
//   Posts:    create (New post), read (feed), update (pen), delete (trash)
//   Comments: create (form), read (list), update (pen), delete (trash + Undo)
// ---------------------------------------------------------------
import { mountLayout } from "./layout.js";
import {
  addComment,
  addPost,
  deleteComment,
  deletePost,
  findCategory,
  findPost,
  getState,
  setActiveCategory,
  subscribe,
  updateComment,
  updatePost,
} from "./store.js";
import { avatar, categoryChip, confirmDialog, esc, openModal, timeAgo, toast } from "./ui.js";

const layout = mountLayout({ page: "posts" });
const main = layout.main;

main.innerHTML = `
  <div class="mx-auto max-w-2xl">
    <div id="head"></div>
    <div id="feed" class="mt-8 space-y-8"></div>
  </div>`;
const head = document.getElementById("head");
const feed = document.getElementById("feed");

// Small bits of page state that are not saved data:
const openComments = new Set(); // which posts have their comments expanded
let editingComment = null; //      { postId, id } while a comment is being edited
const drafts = {}; //               unsent comment text, so a re-draw never eats it
let query = ""; //                 top-bar search text

// ---------------------------------------------------------------
// Reading: which posts should be visible right now?
// ---------------------------------------------------------------
function visiblePosts() {
  const { posts, activeCategory } = getState();
  const q = query.toLowerCase();
  return posts.filter(
    (p) =>
      (activeCategory === "all" || p.categoryId === activeCategory) &&
      (!q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------
function renderHead() {
  const { activeCategory } = getState();
  const category = activeCategory === "all" ? null : findCategory(activeCategory);
  const count = visiblePosts().length;

  head.innerHTML = `
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
          ${category ? `<span class="size-3.5 rounded-full" style="background:${category.color}"></span>` : ""}
          ${esc(category?.name ?? "All posts")}
        </h1>
        <p class="mt-1 text-base-content/60">${count} ${count === 1 ? "post" : "posts"}${query ? ` matching “${esc(query)}”` : ""}</p>
      </div>
      <button data-action="new-post" class="btn btn-primary"><i class="fa-solid fa-plus"></i>New post</button>
    </div>`;
}

function renderFeed() {
  const posts = visiblePosts();
  feed.innerHTML = posts.length
    ? posts.map(postCard).join("")
    : `<div class="rounded-3xl border-2 border-dashed border-base-300 bg-base-100/60 px-6 py-16 text-center">
        <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-xl text-primary"><i class="fa-solid ${query ? "fa-magnifying-glass" : "fa-pen-nib"}"></i></span>
        <h3 class="mt-4 font-display text-xl font-semibold">${query ? "Nothing matches your search" : "No posts here yet"}</h3>
        <p class="mt-1 text-base-content/60">${query ? "Try a different word." : "Write the first one for this category."}</p>
        ${query ? "" : '<button data-action="new-post" class="btn btn-primary mt-5"><i class="fa-solid fa-plus"></i>New post</button>'}
      </div>`;
}

const render = () => {
  renderHead();
  renderFeed();
};

/** Re-draw a single card (used for comment changes, so nothing else flickers). */
function renderCard(postId) {
  const post = findPost(postId);
  const element = document.getElementById(`post-${postId}`);
  if (post && element && visiblePosts().includes(post)) {
    element.outerHTML = postCard(post);
  } else {
    render(); // the post moved category, was filtered out, etc.
  }
}

function postCard(post) {
  const category = findCategory(post.categoryId);
  const open = openComments.has(post.id);
  const color = category?.color ?? "#5b7a74";

  return `
  <article id="post-${post.id}" data-id="${post.id}" class="overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-sm">
    <!-- cover: the photo if there is one, otherwise a colored artwork -->
    <div class="relative aspect-[16/7] overflow-hidden">
      <div class="absolute inset-0" style="background:linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 50%, black))"></div>
      <div class="cover-pattern absolute inset-0"></div>
      <i class="fa-solid fa-feather-pointed absolute -bottom-8 right-6 -rotate-12 text-[9rem] text-white/15"></i>
      ${post.imageUrl ? `<img src="${esc(post.imageUrl)}" alt="" loading="lazy" class="absolute inset-0 size-full object-cover" onerror="this.remove()" />` : ""}

      <div class="absolute left-4 top-4 rounded-full bg-white shadow-sm">${categoryChip(category)}</div>
      <div class="absolute right-4 top-4 flex gap-2">
        <button data-action="edit-post" class="btn btn-circle btn-sm border-0 bg-white/90 text-base-content shadow-sm hover:bg-white" aria-label="Edit post"><i class="fa-solid fa-pen"></i></button>
        <button data-action="delete-post" class="btn btn-circle btn-sm border-0 bg-white/90 text-error shadow-sm hover:bg-white" aria-label="Delete post"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>

    <div class="px-6 pb-5 pt-6">
      <h2 class="font-display text-2xl font-semibold leading-tight">${esc(post.title)}</h2>
      ${post.body ? `<p class="mt-2 whitespace-pre-line leading-relaxed text-base-content/75">${esc(post.body)}</p>` : ""}

      <div class="mt-6 flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          ${avatar(post.author, "size-9 text-sm")}
          <div class="min-w-0 leading-tight">
            <p class="truncate text-sm font-medium">${esc(post.author)}</p>
            <p class="text-xs text-base-content/55">${timeAgo(post.createdAt)}${post.updatedAt ? " (edited)" : ""}</p>
          </div>
        </div>
        <button data-action="toggle-comments" aria-expanded="${open}" class="btn btn-neutral btn-sm rounded-full">
          <i class="fa-regular fa-comment"></i>Comments
          <span class="badge badge-sm border-0 bg-white/20 text-neutral-content">${post.comments.length}</span>
        </button>
      </div>
    </div>

    <!-- comments -->
    <div class="comments ${open ? "open" : ""}">
      <div ${open ? "" : "inert"}>
        <div class="border-t border-base-300 bg-base-200/60 px-6 py-5">
          ${
            post.comments.length
              ? `<ul class="mb-5 space-y-4">${post.comments.map((c) => commentItem(post, c)).join("")}</ul>`
              : '<p class="mb-4 text-sm text-base-content/60">No comments yet. Start the conversation.</p>'
          }
          <form data-form="comment" class="flex items-center gap-3">
            ${avatar(getState().user ?? "?", "size-9 text-sm")}
            <input name="text" class="input grow rounded-full" maxlength="500" required autocomplete="off"
              placeholder="Write a comment" aria-label="Write a comment" value="${esc(drafts[post.id] ?? "")}" />
            <button class="btn btn-primary btn-circle" aria-label="Send comment"><i class="fa-solid fa-paper-plane"></i></button>
          </form>
        </div>
      </div>
    </div>
  </article>`;
}

function commentItem(post, comment) {
  const editing = editingComment?.postId === post.id && editingComment.id === comment.id;

  return `
  <li class="group flex gap-3" data-cid="${comment.id}">
    ${avatar(comment.author, "size-8 text-xs")}
    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <span class="text-sm font-semibold">${esc(comment.author)}</span>
        <span class="text-xs text-base-content/55">${timeAgo(comment.createdAt)}${comment.updatedAt ? " (edited)" : ""}</span>
      </div>
      ${
        editing
          ? `<form data-form="edit-comment" class="mt-1.5 flex items-center gap-2">
              <input name="text" class="input input-sm grow" maxlength="500" required autocomplete="off" aria-label="Edit comment" value="${esc(comment.text)}" />
              <button class="btn btn-primary btn-sm btn-square" aria-label="Save comment"><i class="fa-solid fa-check"></i></button>
              <button type="button" data-action="cancel-edit-comment" class="btn btn-ghost btn-sm btn-square" aria-label="Cancel"><i class="fa-solid fa-xmark"></i></button>
            </form>`
          : `<p class="whitespace-pre-line break-words text-sm leading-relaxed text-base-content/85">${esc(comment.text)}</p>`
      }
    </div>
    ${
      editing
        ? ""
        : `<div class="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100">
            <button data-action="edit-comment" class="btn btn-ghost btn-xs btn-circle" aria-label="Edit comment"><i class="fa-solid fa-pen"></i></button>
            <button data-action="delete-comment" class="btn btn-ghost btn-xs btn-circle text-error" aria-label="Delete comment"><i class="fa-solid fa-trash"></i></button>
          </div>`
    }
  </li>`;
}

// ---------------------------------------------------------------
// Create / Update post: one modal handles both
// ---------------------------------------------------------------
function openPostModal(post = null) {
  const editing = Boolean(post);
  const { categories, activeCategory } = getState();
  const selected = post ? (post.categoryId ?? "") : activeCategory !== "all" ? activeCategory : "";

  const dialog = openModal(`
    <form class="p-6">
      <div class="flex items-start justify-between">
        <h3 class="font-display text-2xl font-semibold">${editing ? "Edit post" : "Write a post"}</h3>
        <button type="button" data-cancel class="btn btn-ghost btn-sm btn-circle -mr-2 -mt-1" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <label class="mt-5 block">
        <span class="mb-1.5 block text-sm font-medium">Title</span>
        <input name="title" class="input w-full" maxlength="90" required autofocus placeholder="Give your post a title" value="${esc(post?.title ?? "")}" />
      </label>

      <label class="mt-4 block">
        <span class="mb-1.5 block text-sm font-medium">Story</span>
        <textarea name="body" class="textarea min-h-32 w-full" maxlength="1000" placeholder="What do you want to share?">${esc(post?.body ?? "")}</textarea>
      </label>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium">Category</span>
          <select name="categoryId" class="select w-full">
            <option value="">Uncategorized</option>
            ${categories.map((c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
          </select>
        </label>
        <label class="block">
          <span class="mb-1.5 block text-sm font-medium">Cover image link <span class="font-normal text-base-content/50">(optional)</span></span>
          <input name="imageUrl" type="url" class="input w-full" placeholder="https://…" value="${esc(post?.imageUrl ?? "")}" />
        </label>
      </div>

      <div class="mt-7 flex justify-end gap-2">
        <button type="button" data-cancel class="btn btn-ghost">Cancel</button>
        <button class="btn btn-primary"><i class="fa-solid ${editing ? "fa-check" : "fa-paper-plane"}"></i>${editing ? "Save changes" : "Publish"}</button>
      </div>
    </form>`);

  dialog.querySelectorAll("[data-cancel]").forEach((b) => b.addEventListener("click", () => dialog.close()));
  dialog.querySelector("form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target));
    if (!data.title.trim()) return;

    if (editing) {
      updatePost(post.id, data);
      toast("Post updated");
    } else {
      const created = addPost(data);
      // Make sure the new post is visible: switch category if it would be filtered out.
      const { activeCategory: current } = getState();
      if (current !== "all" && current !== created.categoryId) setActiveCategory(created.categoryId ?? "all");
      toast("Post published");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    dialog.close();
  });
}

// ---------------------------------------------------------------
// Events: one listener for clicks, one for submits (event delegation)
// ---------------------------------------------------------------
main.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const card = button.closest("article");
  const postId = card?.dataset.id;
  const commentId = button.closest("[data-cid]")?.dataset.cid;

  switch (button.dataset.action) {
    case "new-post":
      openPostModal();
      break;

    case "edit-post":
      openPostModal(findPost(postId));
      break;

    case "delete-post": {
      const post = findPost(postId);
      confirmDialog({
        title: "Delete this post?",
        message: `“${post.title}” and its ${post.comments.length} comment${post.comments.length === 1 ? "" : "s"} will be gone for good.`,
        confirmLabel: "Delete post",
        onConfirm: () => {
          deletePost(postId);
          openComments.delete(postId);
          toast("Post deleted");
        },
      });
      break;
    }

    case "toggle-comments": {
      // Just flip the classes, so the panel animates instead of being re-drawn.
      const open = !openComments.has(postId);
      open ? openComments.add(postId) : openComments.delete(postId);
      card.querySelector(".comments").classList.toggle("open", open);
      card.querySelector(".comments > div").inert = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) card.querySelector("[data-form=comment] input").focus({ preventScroll: true });
      break;
    }

    case "edit-comment":
      editingComment = { postId, id: commentId };
      renderCard(postId);
      document.querySelector(`#post-${postId} [data-form=edit-comment] input`)?.focus();
      break;

    case "cancel-edit-comment":
      editingComment = null;
      renderCard(postId);
      break;

    case "delete-comment": {
      const undo = deleteComment(postId, commentId);
      toast("Comment deleted", { undo, icon: "fa-trash" });
      break;
    }
  }
});

main.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();

  const postId = form.closest("article").dataset.id;
  const text = new FormData(form).get("text").trim();
  if (!text) return;

  if (form.dataset.form === "comment") {
    delete drafts[postId];
    addComment(postId, text);
    document.querySelector(`#post-${postId} [data-form=comment] input`)?.focus({ preventScroll: true });
  } else {
    const { id } = editingComment;
    editingComment = null;
    updateComment(postId, id, text);
    toast("Comment updated");
  }
});

// Remember half-written comments; Esc cancels an edit.
main.addEventListener("input", (event) => {
  const form = event.target.closest("[data-form=comment]");
  if (form) drafts[form.closest("article").dataset.id] = event.target.value;
});
main.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && event.target.closest("[data-form=edit-comment]")) {
    const postId = event.target.closest("article").dataset.id;
    editingComment = null;
    renderCard(postId);
  }
});

// ---------------------------------------------------------------
// Keep the page in sync with the store
// ---------------------------------------------------------------
subscribe((change) => (change.post ? renderCard(change.post) : render()));
layout.onSearch((text) => {
  query = text;
  render();
});

render();
