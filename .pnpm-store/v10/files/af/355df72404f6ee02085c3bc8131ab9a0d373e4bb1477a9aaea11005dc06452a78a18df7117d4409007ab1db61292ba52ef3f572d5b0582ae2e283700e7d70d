"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { performJsSyscall } from "./impl/syscall.js";
export const ROUTABLE_HTTP_METHODS = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "OPTIONS",
  "PATCH"
];
export function normalizeMethod(method) {
  if (method === "HEAD") return "GET";
  return method;
}
export const httpRouter = () => new HttpRouter();
export class HttpRouter {
  constructor() {
    __publicField(this, "exactRoutes", /* @__PURE__ */ new Map());
    __publicField(this, "prefixRoutes", /* @__PURE__ */ new Map());
    __publicField(this, "isRouter", true);
    /**
     * Specify an HttpAction to be used to respond to requests
     * for an HTTP method (e.g. "GET") and a path or pathPrefix.
     *
     * Paths must begin with a slash. Path prefixes must also end in a slash.
     *
     * ```js
     * // matches `/profile` (but not `/profile/`)
     * http.route({ path: "/profile", method: "GET", handler: getProfile})
     *
     * // matches `/profiles/`, `/profiles/abc`, and `/profiles/a/c/b` (but not `/profile`)
     * http.route({ pathPrefix: "/profile/", method: "GET", handler: getProfile})
     * ```
     */
    __publicField(this, "route", (spec) => {
      if (!spec.handler) throw new Error(`route requires handler`);
      if (!spec.method) throw new Error(`route requires method`);
      const { method, handler } = spec;
      if (!ROUTABLE_HTTP_METHODS.includes(method)) {
        throw new Error(
          `'${method}' is not an allowed HTTP method (like GET, POST, PUT etc.)`
        );
      }
      if ("path" in spec) {
        if ("pathPrefix" in spec) {
          throw new Error(
            `Invalid httpRouter route: cannot contain both 'path' and 'pathPrefix'`
          );
        }
        if (!spec.path.startsWith("/")) {
          throw new Error(`path '${spec.path}' does not start with a /`);
        }
        if (spec.path.startsWith("/.files/") || spec.path === "/.files") {
          throw new Error(`path '${spec.path}' is reserved`);
        }
        const methods = this.exactRoutes.has(spec.path) ? this.exactRoutes.get(spec.path) : /* @__PURE__ */ new Map();
        if (methods.has(method)) {
          throw new Error(
            `Path '${spec.path}' for method ${method} already in use`
          );
        }
        methods.set(method, handler);
        this.exactRoutes.set(spec.path, methods);
      } else if ("pathPrefix" in spec) {
        if (!spec.pathPrefix.startsWith("/")) {
          throw new Error(
            `pathPrefix '${spec.pathPrefix}' does not start with a /`
          );
        }
        if (!spec.pathPrefix.endsWith("/")) {
          throw new Error(`pathPrefix ${spec.pathPrefix} must end with a /`);
        }
        if (spec.pathPrefix.startsWith("/.files/")) {
          throw new Error(`pathPrefix '${spec.pathPrefix}' is reserved`);
        }
        const prefixes = this.prefixRoutes.get(method) || /* @__PURE__ */ new Map();
        if (prefixes.has(spec.pathPrefix)) {
          throw new Error(
            `${spec.method} pathPrefix ${spec.pathPrefix} is already defined`
          );
        }
        prefixes.set(spec.pathPrefix, handler);
        this.prefixRoutes.set(method, prefixes);
      } else {
        throw new Error(
          `Invalid httpRouter route entry: must contain either field 'path' or 'pathPrefix'`
        );
      }
    });
    /**
     * Returns a list of routed HTTP actions.
     *
     * These are used to populate the list of routes shown in the Functions page of the Convex dashboard.
     *
     * @returns - an array of [path, method, endpoint] tuples.
     */
    __publicField(this, "getRoutes", () => {
      const exactPaths = [...this.exactRoutes.keys()].sort();
      const exact = exactPaths.flatMap(
        (path) => [...this.exactRoutes.get(path).keys()].sort().map(
          (method) => [path, method, this.exactRoutes.get(path).get(method)]
        )
      );
      const prefixPathMethods = [...this.prefixRoutes.keys()].sort();
      const prefixes = prefixPathMethods.flatMap(
        (method) => [...this.prefixRoutes.get(method).keys()].sort().map(
          (pathPrefix) => [
            `${pathPrefix}*`,
            method,
            this.prefixRoutes.get(method).get(pathPrefix)
          ]
        )
      );
      return [...exact, ...prefixes];
    });
    /**
     * Returns the appropriate HTTP action and its routed request path and method.
     *
     * The path and method returned are used for logging and metrics, and should
     * match up with one of the routes returned by `getRoutes`.
     *
     * For example,
     *
     * ```js
     * http.route({ pathPrefix: "/profile/", method: "GET", handler: getProfile});
     *
     * http.lookup("/profile/abc", "GET") // returns [getProfile, "GET", "/profile/*"]
     *```
     *
     * @returns - a tuple [{@link PublicHttpAction}, method, path] or null.
     */
    __publicField(this, "lookup", (path, method) => {
      method = normalizeMethod(method);
      const exactMatch = this.exactRoutes.get(path)?.get(method);
      if (exactMatch) return [exactMatch, method, path];
      const prefixes = this.prefixRoutes.get(method) || /* @__PURE__ */ new Map();
      const prefixesSorted = [...prefixes.entries()].sort(
        ([prefixA, _a], [prefixB, _b]) => prefixB.length - prefixA.length
      );
      for (const [pathPrefix, endpoint] of prefixesSorted) {
        if (path.startsWith(pathPrefix)) {
          return [endpoint, method, `${pathPrefix}*`];
        }
      }
      return null;
    });
    /**
     * Given a JSON string representation of a Request object, return a Response
     * by routing the request and running the appropriate endpoint or returning
     * a 404 Response.
     *
     * @param argsStr - a JSON string representing a Request object.
     *
     * @returns - a Response object.
     */
    __publicField(this, "runRequest", async (argsStr, requestRoute) => {
      const request = performJsSyscall("requestFromConvexJson", {
        convexJson: JSON.parse(argsStr)
      });
      let pathname = requestRoute;
      if (!pathname || typeof pathname !== "string") {
        pathname = new URL(request.url).pathname;
      }
      const method = request.method;
      const match = this.lookup(pathname, method);
      if (!match) {
        const response2 = new Response(`No HttpAction routed for ${pathname}`, {
          status: 404
        });
        return JSON.stringify(
          performJsSyscall("convexJsonFromResponse", { response: response2 })
        );
      }
      const [endpoint, _method, _path] = match;
      const response = await endpoint.invokeHttpAction(request);
      return JSON.stringify(
        performJsSyscall("convexJsonFromResponse", { response })
      );
    });
  }
}
//# sourceMappingURL=router.js.map
