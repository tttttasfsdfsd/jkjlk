import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { AuthUser } from "./middleware";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
};

// P2-14: Typed context with user — avoids (ctx as any).user casts throughout routers
export type TrpcContextWithUser = TrpcContext & { user: AuthUser };

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  return { req: opts.req, resHeaders: opts.resHeaders };
}
