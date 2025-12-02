import { PublicHttpAction } from "./registration.js";
/**
 * A list of the methods supported by Convex HTTP actions.
 *
 * HEAD is handled by Convex by running GET and stripping the body.
 * CONNECT is not supported and will not be supported.
 * TRACE is not supported and will not be supported.
 *
 * @public
 */
export declare const ROUTABLE_HTTP_METHODS: readonly ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"];
/**
 * A type representing the methods supported by Convex HTTP actions.
 *
 * HEAD is handled by Convex by running GET and stripping the body.
 * CONNECT is not supported and will not be supported.
 * TRACE is not supported and will not be supported.
 *
 * @public
 */
export type RoutableMethod = (typeof ROUTABLE_HTTP_METHODS)[number];
export declare function normalizeMethod(method: RoutableMethod | "HEAD"): RoutableMethod;
/**
 * Return a new {@link HttpRouter} object.
 *
 * @public
 */
export declare const httpRouter: () => HttpRouter;
/**
 * A type representing a route to an HTTP action using an exact request URL path match.
 *
 * Used by {@link HttpRouter} to route requests to HTTP actions.
 *
 * @public
 */
export type RouteSpecWithPath = {
    /**
     * Exact HTTP request path to route.
     */
    path: string;
    /**
     * HTTP method ("GET", "POST", ...) to route.
     */
    method: RoutableMethod;
    /**
     * The HTTP action to execute.
     */
    handler: PublicHttpAction;
};
/**
 * A type representing a route to an HTTP action using a request URL path prefix match.
 *
 * Used by {@link HttpRouter} to route requests to HTTP actions.
 *
 * @public
 */
export type RouteSpecWithPathPrefix = {
    /**
     * An HTTP request path prefix to route. Requests with a path starting with this value
     * will be routed to the HTTP action.
     */
    pathPrefix: string;
    /**
     * HTTP method ("GET", "POST", ...) to route.
     */
    method: RoutableMethod;
    /**
     * The HTTP action to execute.
     */
    handler: PublicHttpAction;
};
/**
 * A type representing a route to an HTTP action.
 *
 * Used by {@link HttpRouter} to route requests to HTTP actions.
 *
 * @public
 */
export type RouteSpec = RouteSpecWithPath | RouteSpecWithPathPrefix;
/**
 * HTTP router for specifying the paths and methods of {@link httpActionGeneric}s
 *
 * An example `convex/http.js` file might look like this.
 *
 * ```js
 * import { httpRouter } from "convex/server";
 * import { getMessagesByAuthor } from "./getMessagesByAuthor";
 * import { httpAction } from "./_generated/server";
 *
 * const http = httpRouter();
 *
 * // HTTP actions can be defined inline...
 * http.route({
 *   path: "/message",
 *   method: "POST",
 *   handler: httpAction(async ({ runMutation }, request) => {
 *     const { author, body } = await request.json();
 *
 *     await runMutation(api.sendMessage.default, { body, author });
 *     return new Response(null, {
 *       status: 200,
 *     });
 *   })
 * });
 *
 * // ...or they can be imported from other files.
 * http.route({
 *   path: "/getMessagesByAuthor",
 *   method: "GET",
 *   handler: getMessagesByAuthor,
 * });
 *
 * // Convex expects the router to be the default export of `convex/http.js`.
 * export default http;
 * ```
 *
 * @public
 */
export declare class HttpRouter {
    exactRoutes: Map<string, Map<RoutableMethod, PublicHttpAction>>;
    prefixRoutes: Map<RoutableMethod, Map<string, PublicHttpAction>>;
    isRouter: true;
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
    route: (spec: RouteSpec) => void;
    /**
     * Returns a list of routed HTTP actions.
     *
     * These are used to populate the list of routes shown in the Functions page of the Convex dashboard.
     *
     * @returns - an array of [path, method, endpoint] tuples.
     */
    getRoutes: () => Array<Readonly<[string, RoutableMethod, PublicHttpAction]>>;
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
    lookup: (path: string, method: RoutableMethod | "HEAD") => Readonly<[PublicHttpAction, RoutableMethod, string]> | null;
    /**
     * Given a JSON string representation of a Request object, return a Response
     * by routing the request and running the appropriate endpoint or returning
     * a 404 Response.
     *
     * @param argsStr - a JSON string representing a Request object.
     *
     * @returns - a Response object.
     */
    runRequest: (argsStr: string, requestRoute: string) => Promise<string>;
}
//# sourceMappingURL=router.d.ts.map