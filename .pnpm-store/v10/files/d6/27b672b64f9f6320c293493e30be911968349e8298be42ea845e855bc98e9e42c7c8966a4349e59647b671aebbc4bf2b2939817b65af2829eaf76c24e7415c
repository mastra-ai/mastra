// express/index.ts
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

// express/index.ts
function ironSession(sessionOptions) {
  return async function ironSessionMiddleware(req, res, next) {
    const session = await getIronSession(req, res, sessionOptions);
    Object.defineProperty(
      req,
      "session",
      getPropertyDescriptorForReqSession(session)
    );
    next();
  };
}
export {
  ironSession
};
//# sourceMappingURL=index.mjs.map