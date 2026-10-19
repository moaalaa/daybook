import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";

// Two pages: Todo is the home page, Profile is the second page.
export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        todo: resolve(import.meta.dirname, "index.html"),
        profile: resolve(import.meta.dirname, "profile.html"),
      },
    },
  },
});
