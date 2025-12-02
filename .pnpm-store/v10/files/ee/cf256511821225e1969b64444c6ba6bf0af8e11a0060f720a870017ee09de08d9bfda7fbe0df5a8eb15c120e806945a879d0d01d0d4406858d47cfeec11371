import * as _better_auth_core1 from "@better-auth/core";
import * as better_call127 from "better-call";

//#region src/integrations/next-js.d.ts
declare function toNextJsHandler(auth: {
  handler: (request: Request) => Promise<Response>;
} | ((request: Request) => Promise<Response>)): {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
  PUT: (request: Request) => Promise<Response>;
  DELETE: (request: Request) => Promise<Response>;
};
declare const nextCookies: () => {
  id: "next-cookies";
  hooks: {
    after: {
      matcher(ctx: _better_auth_core1.HookEndpointContext): true;
      handler: (inputContext: better_call127.MiddlewareInputContext<better_call127.MiddlewareOptions>) => Promise<void>;
    }[];
  };
};
//#endregion
export { nextCookies, toNextJsHandler };