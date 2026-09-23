# Daybook

Posts + Todo app built with **Vite, Tailwind CSS v4, daisyUI 5 and Font Awesome**.
No backend: everything is saved in your browser's localStorage.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

## Where to look (read in this order)

| File | What you learn |
|---|---|
| `src/store.js`  | The data + every CRUD function (create / read / update / delete) |
| `src/ui.js`     | Small helpers: modal, confirm dialog, toast, avatars |
| `src/layout.js` | The shared shell: sidebar, categories, top bar, search |
| `src/posts.js`  | Posts page: posts CRUD + comments CRUD |
| `src/todo.js`   | Todo page: todos CRUD, filters, progress |
| `src/style.css` | Theme colors, fonts, the few custom CSS bits |

## The pattern used everywhere

1. A user action (click / submit) calls a function in `store.js`.
2. The store changes the data, saves it, and calls `emit()`.
3. The page's `subscribe()` callback re-draws the affected part.

## Tweak the look

Open `src/style.css`. Change `--color-primary`, `--color-neutral` (sidebar/buttons)
or `--color-marigold` (the active-category border) and the whole app follows.

## Reset the demo data

Browser console: `localStorage.clear()` then refresh.
