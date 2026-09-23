// ---------------------------------------------------------------
// store.js  —  the single source of truth for the whole app.
//
// Everything (user, categories, posts, comments, todos) lives in one
// object that is saved to localStorage. Every function below is a
// CRUD action: create / read / update / delete.
//
// After each change we call emit() so the UI can re-draw itself.
// (In a real app this file would be replaced by calls to a backend API.)
// ---------------------------------------------------------------

const KEY = "daybook:v1";

export const CATEGORY_COLORS = [
  "#2f9e8f", // teal
  "#3e8ede", // blue
  "#7c6bd6", // violet
  "#e5677d", // rose
  "#e9a23b", // amber
  "#8baa3d", // olive
];

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const ago = (minutes) => Date.now() - minutes * 60 * 1000;

// ----- first-run demo data ------------------------------------
function seed() {
  const work = { id: uid(), name: "Work", color: CATEGORY_COLORS[1] };
  const personal = { id: uid(), name: "Personal", color: CATEGORY_COLORS[3] };
  const learning = { id: uid(), name: "Learning", color: CATEGORY_COLORS[2] };

  return {
    user: null,
    activeCategory: "all",
    categories: [work, personal, learning],
    posts: [
      {
        id: uid(),
        title: "Shipped the first version of the dashboard",
        body: "Two weeks of small steps and it finally feels solid. The biggest lesson: ship the boring version first, then polish it.",
        categoryId: work.id,
        imageUrl: "",
        author: "Daybook",
        createdAt: ago(60 * 5),
        updatedAt: null,
        comments: [
          { id: uid(), author: "Maya", text: "Congrats! The loading states look great.", createdAt: ago(60 * 3), updatedAt: null },
          { id: uid(), author: "Omar", text: "Would love to hear how you handled caching.", createdAt: ago(45), updatedAt: null },
        ],
      },
      {
        id: uid(),
        title: "Learning Tailwind: what finally clicked",
        body: "Stop reading the docs top to bottom. Build one small card, look up only the classes you need, and repeat. Utilities stick faster when you use them.",
        categoryId: learning.id,
        imageUrl: "",
        author: "Daybook",
        createdAt: ago(60 * 26),
        updatedAt: null,
        comments: [],
      },
      {
        id: uid(),
        title: "Sunday reset",
        body: "Groceries, laundry, a long walk. Planning the week on paper before opening any screens made Monday feel lighter.",
        categoryId: personal.id,
        imageUrl: "",
        author: "Daybook",
        createdAt: ago(60 * 50),
        updatedAt: null,
        comments: [],
      },
    ],
    todos: [
      { id: uid(), text: "Review pull requests", done: false, categoryId: work.id, createdAt: ago(30) },
      { id: uid(), text: "Write the release notes", done: true, categoryId: work.id, createdAt: ago(200) },
      { id: uid(), text: "Buy groceries", done: false, categoryId: personal.id, createdAt: ago(400) },
      { id: uid(), text: "Read the daisyUI docs for the modal component", done: false, categoryId: learning.id, createdAt: ago(900) },
    ],
  };
}

// ----- load / save --------------------------------------------
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && Array.isArray(saved.posts)) return saved;
  } catch {
    /* corrupted data: fall through to a fresh seed */
  }
  return seed();
}

let state = load();
const listeners = new Set();

const save = () => localStorage.setItem(KEY, JSON.stringify(state));

/** Save, then tell every subscriber something changed.
 *  `change` optionally says what changed, e.g. { post: "abc" }, so a page
 *  can re-draw just that piece instead of everything. */
function emit(change = {}) {
  save();
  listeners.forEach((fn) => fn(change));
}

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ----- user (a fake "login" so posts and comments get an author) ----
export const setUser = (name) => {
  state.user = name.trim();
  emit();
};
export const logout = () => {
  state.user = null;
  emit();
};

// ----- categories ---------------------------------------------
export const setActiveCategory = (id) => {
  state.activeCategory = id;
  emit();
};

export function addCategory({ name, color }) {
  const category = { id: uid(), name: name.trim(), color };
  state.categories.push(category);
  emit();
  return category;
}

export function updateCategory(id, patch) {
  const category = state.categories.find((c) => c.id === id);
  if (!category) return;
  Object.assign(category, patch);
  emit();
}

/** Deleting a category keeps its posts and todos; they become "Uncategorized". */
export function deleteCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  state.posts.forEach((p) => p.categoryId === id && (p.categoryId = null));
  state.todos.forEach((t) => t.categoryId === id && (t.categoryId = null));
  if (state.activeCategory === id) state.activeCategory = "all";
  emit();
}

export const findCategory = (id) => state.categories.find((c) => c.id === id) ?? null;

// ----- posts --------------------------------------------------
export function addPost({ title, body, categoryId, imageUrl }) {
  const post = {
    id: uid(),
    title: title.trim(),
    body: body.trim(),
    categoryId: categoryId || null,
    imageUrl: imageUrl.trim(),
    author: state.user ?? "Guest",
    createdAt: Date.now(),
    updatedAt: null,
    comments: [],
  };
  state.posts.unshift(post); // newest first
  emit();
  return post;
}

export function updatePost(id, { title, body, categoryId, imageUrl }) {
  const post = state.posts.find((p) => p.id === id);
  if (!post) return;
  Object.assign(post, {
    title: title.trim(),
    body: body.trim(),
    categoryId: categoryId || null,
    imageUrl: imageUrl.trim(),
    updatedAt: Date.now(),
  });
  emit({ post: id });
}

export function deletePost(id) {
  state.posts = state.posts.filter((p) => p.id !== id);
  emit();
}

export const findPost = (id) => state.posts.find((p) => p.id === id) ?? null;

// ----- comments (they live inside their post) -----------------
export function addComment(postId, text) {
  const post = findPost(postId);
  if (!post) return;
  post.comments.push({
    id: uid(),
    author: state.user ?? "Guest",
    text: text.trim(),
    createdAt: Date.now(),
    updatedAt: null,
  });
  emit({ post: postId });
}

export function updateComment(postId, commentId, text) {
  const comment = findPost(postId)?.comments.find((c) => c.id === commentId);
  if (!comment) return;
  comment.text = text.trim();
  comment.updatedAt = Date.now();
  emit({ post: postId });
}

/** Returns an undo() function so the UI can offer "Undo". */
export function deleteComment(postId, commentId) {
  const post = findPost(postId);
  if (!post) return () => {};
  const index = post.comments.findIndex((c) => c.id === commentId);
  if (index === -1) return () => {};
  const [removed] = post.comments.splice(index, 1);
  emit({ post: postId });
  return () => {
    post.comments.splice(index, 0, removed);
    emit({ post: postId });
  };
}

// ----- todos --------------------------------------------------
export function addTodo({ text, categoryId }) {
  state.todos.unshift({
    id: uid(),
    text: text.trim(),
    done: false,
    categoryId: categoryId || null,
    createdAt: Date.now(),
  });
  emit();
}

export function updateTodo(id, patch) {
  const todo = state.todos.find((t) => t.id === id);
  if (!todo) return;
  Object.assign(todo, patch);
  emit();
}

export const toggleTodo = (id) => {
  const todo = state.todos.find((t) => t.id === id);
  if (todo) updateTodo(id, { done: !todo.done });
};

/** Returns an undo() function. */
export function deleteTodo(id) {
  const index = state.todos.findIndex((t) => t.id === id);
  if (index === -1) return () => {};
  const [removed] = state.todos.splice(index, 1);
  emit();
  return () => {
    state.todos.splice(index, 0, removed);
    emit();
  };
}

export function clearCompleted(categoryId) {
  state.todos = state.todos.filter((t) => !(t.done && (categoryId === "all" || t.categoryId === categoryId)));
  emit();
}
