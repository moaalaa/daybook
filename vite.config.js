import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Two separate pages: Posts (index.html) and Todo (todo.html)
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        posts: resolve(import.meta.dirname, "index.html"),
        todo: resolve(import.meta.dirname, "todo.html"),
      },
    },
  },
});
