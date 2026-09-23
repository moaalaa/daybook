// ---------------------------------------------------------------
// ui.js  —  small helpers shared by every page.
// ---------------------------------------------------------------

/** ALWAYS escape user text before putting it in innerHTML (prevents XSS). */
export const esc = (value = "") =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** "5m ago", "3h ago", "2d ago", or a date for older items. */
export function timeAgo(timestamp) {
  const seconds = Math.round((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ----- avatars: a colored circle with the person's initial ------
const AVATAR_COLORS = ["#2f9e8f", "#3e8ede", "#7c6bd6", "#e5677d", "#c98a1b", "#6f8f2a"];

export function avatar(name = "?", size = "size-9 text-sm") {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  return `<span class="inline-flex ${size} shrink-0 items-center justify-center rounded-full font-semibold text-white" style="background:${color}" aria-hidden="true">${esc(name.trim()[0]?.toUpperCase() ?? "?")}</span>`;
}

/** A little colored pill showing a category. */
export function categoryChip(category, extra = "") {
  const color = category?.color ?? "#7b8a86";
  const name = category?.name ?? "Uncategorized";
  return `<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${extra}" style="background:color-mix(in oklab, ${color} 16%, white); color:color-mix(in oklab, ${color} 62%, black)">
    <span class="size-2 rounded-full" style="background:${color}"></span>${esc(name)}</span>`;
}

// ----- modal (built on daisyUI's <dialog class="modal">) --------
/**
 * Opens a modal with any HTML inside and returns the <dialog> element.
 * Call dialog.close() to close it. It removes itself from the page afterwards.
 */
export function openModal(html, { dismissible = true, width = "max-w-lg" } = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "modal modal-bottom sm:modal-middle";
  dialog.innerHTML = `
    <div class="modal-box ${width} rounded-2xl p-0">${html}</div>
    ${dismissible ? '<form method="dialog" class="modal-backdrop"><button aria-label="Close">close</button></form>' : ""}`;
  if (!dismissible) dialog.addEventListener("cancel", (e) => e.preventDefault()); // block the Esc key
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return dialog;
}

/** Ask "are you sure?" and run onConfirm() if the user says yes. */
export function confirmDialog({ title, message, confirmLabel = "Delete", onConfirm }) {
  const dialog = openModal(
    `<div class="p-6">
      <div class="flex items-start gap-4">
        <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"><i class="fa-solid fa-triangle-exclamation"></i></span>
        <div>
          <h3 class="font-display text-xl font-semibold">${esc(title)}</h3>
          <p class="mt-1 text-base-content/70">${esc(message)}</p>
        </div>
      </div>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn btn-ghost" data-cancel>Cancel</button>
        <button class="btn btn-error" data-confirm><i class="fa-solid fa-trash"></i>${esc(confirmLabel)}</button>
      </div>
    </div>`,
    { width: "max-w-md" },
  );
  dialog.querySelector("[data-cancel]").addEventListener("click", () => dialog.close());
  dialog.querySelector("[data-confirm]").addEventListener("click", () => {
    dialog.close();
    onConfirm();
  });
}

// ----- toast: a small message in the bottom-right corner --------
export function toast(message, { undo, icon = "fa-circle-check" } = {}) {
  let host = document.getElementById("toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "toast-host";
    host.className = "fixed bottom-4 right-4 z-[100] flex flex-col items-end gap-2";
    host.setAttribute("aria-live", "polite");
    document.body.append(host);
  }

  const el = document.createElement("div");
  el.className = "flex items-center gap-3 rounded-xl bg-neutral px-4 py-3 text-sm text-neutral-content shadow-lg";
  el.innerHTML = `<i class="fa-solid ${icon} text-secondary"></i><span>${esc(message)}</span>`;

  const remove = () => el.remove();
  if (undo) {
    const button = document.createElement("button");
    button.className = "ml-1 font-semibold text-secondary underline-offset-2 hover:underline";
    button.textContent = "Undo";
    button.addEventListener("click", () => {
      undo();
      remove();
    });
    el.append(button);
  }
  host.append(el);
  setTimeout(remove, undo ? 6000 : 3000);
}
