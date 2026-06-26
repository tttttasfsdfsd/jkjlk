import { createRouter } from "./middleware";
import { chatRouter }    from "./routers/chat";
import { authRouter }    from "./routers/auth";
import { billingRouter } from "./routers/billing";

export const appRouter = createRouter({
  auth:    authRouter,
  chat:    chatRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
