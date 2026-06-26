import { serve } from "@hono/node-server";
import app from "./api/boot.ts";

const port = 3001;
serve({ fetch: app.fetch, port }, () => {
  console.log(`API Server running on http://localhost:${port}/`);
});
