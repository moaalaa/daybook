// ---------------------------------------------------------------
// dom.js — tiny helpers used by posts.js and todo.js.
// No HTML is built from strings here: we clone <template> elements
// that already live in the page and fill in text/attributes.
// ---------------------------------------------------------------

/** Clone a <template>'s content and return its single root element. */
export function clone(templateId) {
  const template = document.getElementById(templateId);
  return template.content.firstElementChild.cloneNode(true);
}

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

const AVATAR_COLORS = ["#2f9e8f", "#3e8ede", "#7c6bd6", "#e5677d", "#c98a1b", "#6f8f2a"];

/** Fills an existing avatar <span> with the right initial + background color. */
export function fillAvatar(span, name = "?") {
  const hash = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  span.style.background = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  span.textContent = name.trim()[0]?.toUpperCase() ?? "?";
}

/** Fills a chip (dot + name spans) for a category, or "Uncategorized".
 *  If the chip element has no dot/name children yet (e.g. a bare <span>), it builds them. */
export function fillCategoryChip(chip, category) {
  const color = category?.color ?? "#7b8a86";
  const name = category?.name ?? "Uncategorized";
  chip.style.background = `color-mix(in oklab, ${color} 16%, white)`;
  chip.style.color = `color-mix(in oklab, ${color} 62%, black)`;

  let dot = chip.querySelector('[data-role="dot"], [data-role="chip-dot"]');
  let nameEl = chip.querySelector('[data-role="name"], [data-role="chip-name"]');

  if (!dot) {
    dot = document.createElement("span");
    dot.className = "size-2 rounded-full";
    chip.append(dot);
  }
  if (!nameEl) {
    nameEl = document.createElement("span");
    chip.append(nameEl);
  }

  dot.style.background = color;
  nameEl.textContent = name;
}

// ----- modal: clone a <template>'s content into a real <dialog> ------
/**
 * Opens a <dialog class="modal"> containing a clone of formTemplateId's content.
 * Returns { dialog, form } so the caller can fill fields and listen for submit.
 */
export function openModal(templateId, { dismissible = true, width = "max-w-lg" } = {}) {
  const dialog = document.createElement("dialog");
  dialog.className = "modal modal-bottom sm:modal-middle";

  const box = document.createElement("div");
  box.className = `modal-box ${width} rounded-2xl p-0`;
  box.append(clone(templateId));
  dialog.append(box);

  if (dismissible) {
    const backdrop = document.createElement("form");
    backdrop.method = "dialog";
    backdrop.className = "modal-backdrop";
    const btn = document.createElement("button");
    btn.setAttribute("aria-label", "Close");
    btn.textContent = "close";
    backdrop.append(btn);
    dialog.append(backdrop);
  } else {
    dialog.addEventListener("cancel", (e) => e.preventDefault());
  }

  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();

  dialog.querySelectorAll('[data-action="close-modal"], [data-action="cancel"]').forEach((btn) =>
    btn.addEventListener("click", () => dialog.close()),
  );

  return dialog;
}

/** Ask "are you sure?" using #confirm-template and run onConfirm() if the user agrees. */
export function confirmDialog({ title, message, confirmLabel = "Delete", onConfirm }) {
  const dialog = openModal("confirm-template", { width: "max-w-md" });
  dialog.querySelector('[data-role="title"]').textContent = title;
  dialog.querySelector('[data-role="message"]').textContent = message;
  dialog.querySelector('[data-role="confirm-label"]').textContent = confirmLabel;
  dialog.querySelector('[data-action="confirm"]').addEventListener("click", () => {
    dialog.close();
    onConfirm();
  });
}

// ----- toast: a small message bottom-right, built from real elements ---
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

  const iconEl = document.createElement("i");
  iconEl.className = `fa-solid ${icon} text-secondary`;
  const textEl = document.createElement("span");
  textEl.textContent = message;
  el.append(iconEl, textEl);

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
