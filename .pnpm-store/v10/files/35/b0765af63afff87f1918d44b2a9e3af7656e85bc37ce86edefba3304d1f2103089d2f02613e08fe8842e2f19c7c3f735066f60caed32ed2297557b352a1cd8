// koa/index.ts
import { getIronSession } from "iron-session";

// src/getPropertyDescriptorForReqSession.ts
function getPropertyDescriptorForReqSession(session) {
  return {
    enumerable: true,
    get() {
      return session;
    },
    set(value) {
      const keys = Object.keys(value);
      const currentKeys = Object.keys(session);
      currentKeys.forEach((key) => {
        if (!keys.includes(key)) {
          delete session[key];
        }
      });
      keys.forEach((key) => {
        session[key] = value[key];
      });
    }
  };
}

// koa/index.ts
function ironSession(sessionOptions) {
  return async function ironSessionMiddleWare(ctx, next) {
    const session = await getIronSession(ctx.req, ctx.res, sessionOptions);
    Object.defineProperty(
      ctx,
      "session",
      getPropertyDescriptorForReqSession(session)
    );
    await next();
  };
}
export {
  ironSession
};
//# sourceMappingURL=index.mjs.map