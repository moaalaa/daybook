# Daybook

Posts + Todo app: **plain static HTML** (Tailwind CSS v4, daisyUI 5, Font Awesome)
with **one JavaScript file** for behavior. No React/Vue/Nuxt/Next, no JS templating,
no virtual DOM. Data is saved to the browser's localStorage.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## What's actually in this project

- **`index.html`** and **`todo.html`** — real, complete HTML pages. Every post,
  comment, todo, category and modal is written out as literal markup. Right-click
  → View Page Source in a running app and you'll see the same tags you'd write
  by hand — nothing is built by JavaScript.
- **`src/app.js`** — the only script. It doesn't generate HTML strings and it
  doesn't use `<template>` cloning. It just:
  - reads/writes `data-*` attributes and text on elements that already exist,
  - shows/hides existing daisyUI `<dialog>` modals with `.showModal()` / `.close()`,
  - saves the current state to `localStorage` and restores it on load.
- **Modals are plain daisyUI.** Each one (`#post_modal`, `#category_modal`,
  `#confirm_modal`, …) is a real `<dialog class="modal">` sitting in the HTML.
  Because it has an `id`, the browser exposes it as a global automatically, so
  `onclick="post_modal.showModal()"` in the markup is enough — that's the normal,
  documented way to use daisyUI's dialog-based modal. No custom modal system.

## Why this works inside Livewire / Vue / Nuxt / React / Next

Nothing here assumes a JS framework runtime. It's:
- plain `<dialog>`, `<form>`, `onclick`/`onsubmit` attributes — supported by every
  browser and every framework's raw HTML output,
- one script tag, no build-time JSX/SFC compilation required to understand it,
- functions attached to `window` so inline HTML attributes can call them, which is
  exactly how you'd wire up behavior in a server-rendered Blade/Livewire view too.

You can lift `index.html`'s markup into a Blade view or a Vue template's static
parts, drop `app.js` in as-is (or port the handful of functions to Alpine/Livewire
actions), and it behaves the same.

## Where to look

| File | What it does |
|---|---|
| `index.html` | Posts page: every post + comment written directly as HTML, plus the post/category/comment/confirm/welcome `<dialog>` modals |
| `todo.html` | Todo page: every todo written directly as HTML, plus the todo/category/confirm/welcome `<dialog>` modals |
| `src/app.js` | All behavior: category select, search, filters, and full add/edit/delete for posts, comments, todos, categories |
| `src/style.css` | Theme colors, fonts |

## Tweak the look

Open `src/style.css`. Change `--color-primary`, `--color-neutral` (sidebar/buttons)
or `--color-marigold` (the active-category border) and the whole app follows.

## Reset the demo data

Browser console: `localStorage.clear()` then refresh.
