// ---------------------------------------------------------------
// posts.js — behavior for index.html.
// Reads the real HTML already on the page (#feed, #new-post-btn, ...),
// clones #post-template / #comment-template for each item, and fills
// them in with textContent (never innerHTML with user data).
// ---------------------------------------------------------------
import { initSidebar, refreshCounts, getActiveCategoryId } from "./sidebar.js";
import {
  addComment,
  addPost,
  deleteComment,
  deletePost,
  findCategory,
  findPost,
  getState,
  updateComment,
  updatePost,
} from "./store.js";
import { clone, confirmDialog, fillAvatar, fillCategoryChip, openModal, timeAgo, toast } from "./dom.js";

const feed = document.getElementById("feed");
const feedEmpty = document.getElementById("feed-empty");
const feedTitle = document.getElementById("feed-title");
const feedCount = document.getElementById("feed-count");
const searchInput = document.getElementById("search");

const openComments = new Set();
let editingComment = null; // { postId, id }
let query = "";

// ---------------------------------------------------------------
// Reading
// ---------------------------------------------------------------
function postsInCategory(categoryId) {
  const { posts } = getState();
  return posts.filter((p) => categoryId === "all" || p.categoryId === categoryId);
}

function visiblePosts() {
  const q = query.toLowerCase();
  return postsInCategory(getActiveCategoryId()).filter(
    (p) => !q || p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------
function renderHead() {
  const activeCategory = getActiveCategoryId();
  const category = activeCategory === "all" ? null : findCategory(activeCategory);
  const count = visiblePosts().length;

  feedTitle.textContent = category?.name ?? "All posts";
  if (category) {
    const dot = document.createElement("span");
    dot.className = "size-3.5 rounded-full";
    dot.style.background = category.color;
    feedTitle.prepend(dot);
  }
  feedCount.textContent = `${count} ${count === 1 ? "post" : "posts"}${query ? ` matching "${query}"` : ""}`;
}

function renderFeed() {
  const posts = visiblePosts();
  feed.innerHTML = "";
  feed.classList.toggle("hidden", posts.length === 0);
  feedEmpty.classList.toggle("hidden", posts.length > 0);

  if (posts.length === 0) {
    document.getElementById("feed-empty-icon").className = `fa-solid ${query ? "fa-magnifying-glass" : "fa-pen-nib"}`;
    document.getElementById("feed-empty-title").textContent = query ? "Nothing matches your search" : "No posts here yet";
    document.getElementById("feed-empty-text").textContent = query ? "Try a different word." : "Write the first one for this category.";
    document.getElementById("feed-empty-btn").classList.toggle("hidden", Boolean(query));
    return;
  }

  posts.forEach((post) => feed.append(buildPostCard(post)));
}

function render() {
  renderHead();
  renderFeed();
  refreshCounts();
}

function buildPostCard(post) {
  const category = findCategory(post.categoryId);
  const color = category?.color ?? "#5b7a74";
  const article = clone("post-template");
  article.id = `post-${post.id}`;
  article.dataset.id = post.id;

  const cover = article.querySelector('[data-role="cover"]');
  cover.style.background = `linear-gradient(135deg, ${color}, color-mix(in oklab, ${color} 50%, black))`;

  const chip = article.querySelector('[data-role="chip"]');
  fillCategoryChip(chip, category);

  const img = article.querySelector('[data-role="image"]');
  if (post.imageUrl) {
    img.src = post.imageUrl;
    img.classList.remove("hidden");
    img.addEventListener("error", () => img.remove());
  }

  article.querySelector('[data-role="title"]').textContent = post.title;
  const bodyEl = article.querySelector('[data-role="body"]');
  if (post.body) {
    bodyEl.textContent = post.body;
    bodyEl.classList.remove("hidden");
  }

  fillAvatar(article.querySelector('[data-role="avatar"]'), post.author);
  article.querySelector('[data-role="author"]').textContent = post.author;
  article.querySelector('[data-role="time"]').textContent = timeAgo(post.createdAt) + (post.updatedAt ? " (edited)" : "");
  article.querySelector('[data-role="comment-count"]').textContent = post.comments.length;

  fillAvatar(article.querySelector('[data-role="comment-form-avatar"]'), getState().user ?? "?");

  const panel = article.querySelector('[data-role="comments-panel"]');
  const open = openComments.has(post.id);
  panel.classList.toggle("open", open);
  panel.querySelector(":scope > div").inert = !open;
  article.querySelector('[data-action="toggle-comments"]').setAttribute("aria-expanded", String(open));

  fillComments(article, post);
  return article;
}

function fillComments(article, post) {
  const list = article.querySelector('[data-role="comment-list"]');
  const empty = article.querySelector('[data-role="no-comments"]');
  list.innerHTML = "";
  list.classList.toggle("hidden", post.comments.length === 0);
  empty.classList.toggle("hidden", post.comments.length > 0);

  post.comments.forEach((comment) => list.append(buildCommentItem(post, comment)));
}

function buildCommentItem(post, comment) {
  const li = clone("comment-template");
  li.dataset.cid = comment.id;

  fillAvatar(li.querySelector('[data-role="avatar"]'), comment.author);
  li.querySelector('[data-role="author"]').textContent = comment.author;
  li.querySelector('[data-role="time"]').textContent = timeAgo(comment.createdAt) + (comment.updatedAt ? " (edited)" : "");

  const editing = editingComment?.postId === post.id && editingComment.id === comment.id;
  const textEl = li.querySelector('[data-role="text"]');
  const form = li.querySelector('[data-role="edit-form"]');
  const actions = li.querySelector('[data-role="comment-actions"]');

  if (editing) {
    textEl.hidden = true;
    actions.hidden = true;
    form.hidden = false;
    form.querySelector("input[name=text]").value = comment.text;
  } else {
    textEl.textContent = comment.text;
  }

  return li;
}

/** Re-draw one post card in place (used after a comment changes). */
function refreshCard(postId) {
  const post = findPost(postId);
  const existing = document.getElementById(`post-${postId}`);
  if (post && existing && visiblePosts().some((p) => p.id === postId)) {
    existing.replaceWith(buildPostCard(post));
  } else {
    render();
  }
}

// ---------------------------------------------------------------
// Create / edit post modal
// ---------------------------------------------------------------
function openPostModal(post = null) {
  const editing = Boolean(post);
  const { categories } = getState();
  const activeCategory = getActiveCategoryId();
  const selected = post ? (post.categoryId ?? "") : activeCategory !== "all" ? activeCategory : "";

  const dialog = openModal("post-form-template");
  dialog.querySelector('[data-role="modal-title"]').textContent = editing ? "Edit post" : "Write a post";
  const submitBtn = dialog.querySelector('[data-role="submit-btn"]');
  submitBtn.lastChild.textContent = editing ? "Save changes" : "Publish";
  submitBtn.querySelector("i").className = `fa-solid ${editing ? "fa-check" : "fa-paper-plane"}`;

  const form = dialog.querySelector("form");
  form.title.value = post?.title ?? "";
  form.body.value = post?.body ?? "";
  form.imageUrl.value = post?.imageUrl ?? "";

  const select = dialog.querySelector('[data-role="category-select"]');
  categories.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.name;
    if (c.id === selected) option.selected = true;
    select.append(option);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    if (!data.title.trim()) return;

    if (editing) {
      updatePost(post.id, data);
      toast("Post updated");
      refreshCard(post.id);
    } else {
      const created = addPost(data);
      toast("Post published");
      if (activeCategory !== "all" && activeCategory !== (created.categoryId ?? "all")) {
        // the new post may not be visible in the current filter; jump to its category
        document.querySelector(`[data-cat="${created.categoryId ?? "all"}"]`)?.click();
      } else {
        render();
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    dialog.close();
  });
}

// ---------------------------------------------------------------
// Events (delegated)
// ---------------------------------------------------------------
document.getElementById("new-post-btn").addEventListener("click", () => openPostModal());
document.getElementById("feed-empty-btn").addEventListener("click", () => openPostModal());

feed.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const article = button.closest("article");
  const postId = article.dataset.id;
  const commentLi = button.closest("[data-cid]");
  const commentId = commentLi?.dataset.cid;

  switch (button.dataset.action) {
    case "edit-post":
      openPostModal(findPost(postId));
      break;

    case "delete-post": {
      const post = findPost(postId);
      confirmDialog({
        title: "Delete this post?",
        message: `"${post.title}" and its ${post.comments.length} comment${post.comments.length === 1 ? "" : "s"} will be gone for good.`,
        confirmLabel: "Delete post",
        onConfirm: () => {
          deletePost(postId);
          openComments.delete(postId);
          render();
          toast("Post deleted");
        },
      });
      break;
    }

    case "toggle-comments": {
      const open = !openComments.has(postId);
      open ? openComments.add(postId) : openComments.delete(postId);
      const panel = article.querySelector('[data-role="comments-panel"]');
      panel.classList.toggle("open", open);
      panel.querySelector(":scope > div").inert = !open;
      button.setAttribute("aria-expanded", String(open));
      if (open) panel.querySelector('[data-role="comment-form"] input').focus({ preventScroll: true });
      break;
    }

    case "edit-comment":
      editingComment = { postId, id: commentId };
      refreshCard(postId);
      document.querySelector(`#post-${postId} [data-cid="${commentId}"] input[name=text]`)?.focus();
      break;

    case "cancel-edit-comment":
      editingComment = null;
      refreshCard(postId);
      break;

    case "delete-comment": {
      const undo = deleteComment(postId, commentId);
      refreshCard(postId);
      toast("Comment deleted", { undo: () => (undo(), refreshCard(postId)), icon: "fa-trash" });
      break;
    }
  }
});

feed.addEventListener("submit", (event) => {
  const form = event.target;
  const article = form.closest("article");
  if (!article) return;
  event.preventDefault();

  const postId = article.dataset.id;
  const text = new FormData(form).get("text").trim();
  if (!text) return;

  if (form.matches('[data-role="comment-form"]')) {
    addComment(postId, text);
    refreshCard(postId);
    document.querySelector(`#post-${postId} [data-role="comment-form"] input`)?.focus({ preventScroll: true });
  } else if (form.matches('[data-role="edit-form"]')) {
    const { id } = editingComment;
    editingComment = null;
    updateComment(postId, id, text);
    refreshCard(postId);
    toast("Comment updated");
  }
});

feed.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && event.target.closest('[data-role="edit-form"]')) {
    const postId = event.target.closest("article").dataset.id;
    editingComment = null;
    refreshCard(postId);
  }
});

searchInput.addEventListener("input", () => {
  query = searchInput.value.trim();
  render();
});

// ---------------------------------------------------------------
// Boot
// ---------------------------------------------------------------
initSidebar({
  onChange: () => render(),
  countFn: (categoryId) => postsInCategory(categoryId).length,
});
render();
