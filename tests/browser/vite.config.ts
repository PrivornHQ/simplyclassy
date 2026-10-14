import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  root: fileURLToPath(new URL("../../", import.meta.url)),
  cacheDir: "node_modules/.vite-variant-tests",
  resolve: {
    alias: [
      {
        find: "@/lib/order.functions",
        replacement: fileURLToPath(new URL("order.functions.ts", import.meta.url)),
      },
      { find: "@", replacement: fileURLToPath(new URL("../../src", import.meta.url)) },
    ],
  },
  plugins: [react(), tailwind()],
});
