import { resolve } from "node:path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/library/",
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        course: resolve(__dirname, "course.html"),
        search: resolve(__dirname, "search.html"),
        lesson: resolve(__dirname, "lesson.html")
      }
    }
  }
});
