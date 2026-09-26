# Daybook

Posts + Todo app: **real HTML** (Tailwind CSS v4, daisyUI 5, Font Awesome), plain
JavaScript for behavior only — no React/Vue, no HTML built from JS strings.
No backend: data is saved in your browser's localStorage.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Why this isn't "JS framework-y"

- `index.html` and `todo.html` contain the **actual markup** — every button, form,
  heading and list you see is written directly in HTML. View-source and it's all there.
- Repeating things (a post card, a comment, a todo row, a category) are real
  `<template>` tags in the HTML — a native browser feature, not a template string.
  JS clones them (`content.cloneNode`) and fills in text with `textContent`.
- The JS files only do three things: query elements that already exist, clone a
  `<template>` when a new item is needed, and listen for clicks/submits.

## Where to look (read in this order)

| File | What it does |
|---|---|
| `index.html` / `todo.html` | The real markup for each page, plus the `<template>` tags |
| `src/store.js`  | Data + CRUD functions (create / read / update / delete), saved to localStorage |
| `src/dom.js`    | Tiny helpers: clone a template, open a modal, show a toast |
| `src/sidebar.js`| Behavior for the sidebar/header that's shared by both pages |
| `src/posts.js`  | Posts page behavior: posts CRUD + comments CRUD |
| `src/todo.js`   | Todo page behavior: todos CRUD, filters, progress |
| `src/style.css` | Theme colors, fonts |

## The pattern used everywhere

1. A user action (click / submit) calls a function in `store.js`.
2. The store updates the data and saves it to localStorage.
3. The page's JS re-draws just the part of the *existing* HTML that changed —
   usually by cloning a `<template>` and calling `.append()` / `.replaceWith()`.

## Tweak the look

Open `src/style.css`. Change `--color-primary`, `--color-neutral` (sidebar/buttons)
or `--color-marigold` (the active-category border) and the whole app follows.

## Reset the demo data

Browser console: `localStorage.clear()` then refresh.
