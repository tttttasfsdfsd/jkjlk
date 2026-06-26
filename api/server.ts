import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router.js";
import { createContext } from "./context.js";

// Import handlers from boot but create fresh server
// to avoid production-only serve block
const { default: app } = await import("./boot.js");

const port = parseInt(process.env.API_PORT || "3001");

serve({ fetch: app.fetch, port }, () => {
  console.log(`✅ AI-CFO API running on http://localhost:${port}/api`);
});
