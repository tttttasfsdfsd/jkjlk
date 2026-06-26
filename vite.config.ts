import path from "path"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // P3-16: Code splitting — target <200KB per chunk gzipped
    rollupOptions: {
      output: {
        manualChunks: {
          // Core vendor — React + tRPC client
          vendor: [
            "react",
            "react-dom",
            "@trpc/client",
            "@trpc/react-query",
            "@tanstack/react-query",
          ],
          // Charting — loaded only when dashboard panels render
          charts: [
            "chart.js",
            "recharts",
          ],
          // Excel parsing — heavy, loaded only for .xlsx/.xlsm files
          excel: [
            "xlsx",
          ],
          // PDF parsing — loaded only for .pdf files
          pdf: [
            "pdfjs-dist",
          ],
          // UI primitives — radix + lucide (shared across all routes)
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "lucide-react",
            "class-variance-authority",
            "clsx",
            "tailwind-merge",
          ],
        },
      },
    },
    // Warn when any chunk exceeds 250KB
    chunkSizeWarningLimit: 250,
  },
});
