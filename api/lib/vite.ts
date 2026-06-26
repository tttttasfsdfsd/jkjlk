import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");
  // Relative path from CWD — must match where the server is run from
  const relativeRoot = path.relative(process.cwd(), distPath);

  // Serve static assets (JS, CSS, images, etc.)
  app.use("*", serveStatic({ root: relativeRoot }));

  // SPA fallback: serve index.html for all unmatched routes (client-side routing)
  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    const indexPath = path.resolve(distPath, "index.html");

    // Always serve index.html for HTML requests (SPA routing)
    if (accept.includes("text/html") || accept === "*/*" || accept === "") {
      try {
        const content = fs.readFileSync(indexPath, "utf-8");
        return c.html(content);
      } catch {
        return c.text("App not built. Run: npm run build", 500);
      }
    }

    return c.json({ error: "Not Found" }, 404);
  });
}
