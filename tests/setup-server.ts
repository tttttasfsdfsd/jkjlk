/**
 * Test server setup — spins up Hono app in-process for integration/E2E tests.
 * No external port dependency — uses Node.js HTTP server on random port.
 */
import { type Server } from "http";

let server: Server | null = null;
let baseUrl = "http://localhost:3001";

export async function startTestServer(): Promise<string> {
  if (server) return baseUrl;

  process.env.LMDB_PATH = `/tmp/eexa-test-${Date.now()}`;
  process.env.NODE_ENV   = "test";

  // Dynamically import boot to avoid top-level side effects
  const { default: app } = await import("../api/boot");
  const { createServer } = await import("http");

  return new Promise((resolve, reject) => {
    const httpServer = createServer(async (req, res) => {
      // Convert Node IncomingMessage to Fetch Request
      const url  = `http://localhost${req.url}`;
      const chunks: Buffer[] = [];
      req.on("data", chunk => chunks.push(chunk));
      req.on("end", async () => {
        const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) {
          if (v) headers.set(k, Array.isArray(v) ? v[0] : v);
        }
        try {
          const fetchReq = new Request(url, {
            method:  req.method ?? "GET",
            headers,
            body:    body?.length ? body : undefined,
          });
          const honoRes = await app.fetch(fetchReq);
          res.writeHead(honoRes.status, Object.fromEntries(honoRes.headers.entries()));
          const buf = await honoRes.arrayBuffer();
          res.end(Buffer.from(buf));
        } catch (e) {
          res.writeHead(500);
          res.end(String(e));
        }
      });
    });

    httpServer.listen(0, "127.0.0.1", () => {
      const addr = httpServer.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      server  = httpServer;
      console.log(`[test-server] listening on ${baseUrl}`);
      resolve(baseUrl);
    });

    httpServer.on("error", reject);
  });
}

export async function stopTestServer(): Promise<void> {
  if (!server) return;
  return new Promise(resolve => server!.close(() => { server = null; resolve(); }));
}

export function getBaseUrl(): string { return baseUrl; }
