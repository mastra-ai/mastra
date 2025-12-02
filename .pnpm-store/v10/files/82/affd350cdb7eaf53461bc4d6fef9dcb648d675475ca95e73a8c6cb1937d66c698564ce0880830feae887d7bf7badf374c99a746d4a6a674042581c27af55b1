// next/index.ts
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

// next/index.ts
function withIronSessionApiRoute(handler, options) {
  return async function nextApiHandlerWrappedWithIronSession(req, res) {
    let sessionOptions;
    if (options instanceof Function) {
      sessionOptions = await options(req, res);
    } else {
      sessionOptions = options;
    }
    const session = await getIronSession(req, res, sessionOptions);
    Object.defineProperty(
      req,
      "session",
      getPropertyDescriptorForReqSession(session)
    );
    return handler(req, res);
  };
}
function withIronSessionSsr(handler, options) {
  return async function nextGetServerSidePropsHandlerWrappedWithIronSession(context) {
    let sessionOptions;
    if (options instanceof Function) {
      sessionOptions = await options(context.req, context.res);
    } else {
      sessionOptions = options;
    }
    const session = await getIronSession(
      context.req,
      context.res,
      sessionOptions
    );
    Object.defineProperty(
      context.req,
      "session",
      getPropertyDescriptorForReqSession(session)
    );
    return handler(context);
  };
}
export {
  withIronSessionApiRoute,
  withIronSessionSsr
};
//# sourceMappingURL=index.mjs.map