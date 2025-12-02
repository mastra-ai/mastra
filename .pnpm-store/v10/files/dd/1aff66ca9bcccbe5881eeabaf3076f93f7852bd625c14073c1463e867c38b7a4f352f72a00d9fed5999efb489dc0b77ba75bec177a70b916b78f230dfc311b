import * as React from 'react';

/**
 * Actions represent the type of change to a location value.
 */
declare enum Action {
    /**
     * A POP indicates a change to an arbitrary index in the history stack, such
     * as a back or forward navigation. It does not describe the direction of the
     * navigation, only that the current index changed.
     *
     * Note: This is the default action for newly created history objects.
     */
    Pop = "POP",
    /**
     * A PUSH indicates a new entry being added to the history stack, such as when
     * a link is clicked and a new page loads. When this happens, all subsequent
     * entries in the stack are lost.
     */
    Push = "PUSH",
    /**
     * A REPLACE indicates the entry at the current index in the history stack
     * being replaced by a new one.
     */
    Replace = "REPLACE"
}
/**
 * The pathname, search, and hash values of a URL.
 */
interface Path {
    /**
     * A URL pathname, beginning with a /.
     */
    pathname: string;
    /**
     * A URL search string, beginning with a ?.
     */
    search: string;
    /**
     * A URL fragment identifier, beginning with a #.
     */
    hash: string;
}
/**
 * An entry in a history stack. A location contains information about the
 * URL path, as well as possibly some arbitrary state and a key.
 */
interface Location<State = any> extends Path {
    /**
     * A value of arbitrary data associated with this location.
     */
    state: State;
    /**
     * A unique string associated with this location. May be used to safely store
     * and retrieve data in some other storage API, like `localStorage`.
     *
     * Note: This value is always "default" on the initial location.
     */
    key: string;
}
/**
 * A change to the current location.
 */
interface Update {
    /**
     * The action that triggered the change.
     */
    action: Action;
    /**
     * The new location.
     */
    location: Location;
    /**
     * The delta between this location and the former location in the history stack
     */
    delta: number | null;
}
/**
 * A function that receives notifications about location changes.
 */
interface Listener {
    (update: Update): void;
}
/**
 * Describes a location that is the destination of some navigation used in
 * {@link Link}, {@link useNavigate}, etc.
 */
type To = string | Partial<Path>;
/**
 * A history is an interface to the navigation stack. The history serves as the
 * source of truth for the current location, as well as provides a set of
 * methods that may be used to change it.
 *
 * It is similar to the DOM's `window.history` object, but with a smaller, more
 * focused API.
 */
interface History {
    /**
     * The last action that modified the current location. This will always be
     * Action.Pop when a history instance is first created. This value is mutable.
     */
    readonly action: Action;
    /**
     * The current location. This value is mutable.
     */
    readonly location: Location;
    /**
     * Returns a valid href for the given `to` value that may be used as
     * the value of an <a href> attribute.
     *
     * @param to - The destination URL
     */
    createHref(to: To): string;
    /**
     * Returns a URL for the given `to` value
     *
     * @param to - The destination URL
     */
    createURL(to: To): URL;
    /**
     * Encode a location the same way window.history would do (no-op for memory
     * history) so we ensure our PUSH/REPLACE navigations for data routers
     * behave the same as POP
     *
     * @param to Unencoded path
     */
    encodeLocation(to: To): Path;
    /**
     * Pushes a new location onto the history stack, increasing its length by one.
     * If there were any entries in the stack after the current one, they are
     * lost.
     *
     * @param to - The new URL
     * @param state - Data to associate with the new location
     */
    push(to: To, state?: any): void;
    /**
     * Replaces the current location in the history stack with a new one.  The
     * location that was replaced will no longer be available.
     *
     * @param to - The new URL
     * @param state - Data to associate with the new location
     */
    replace(to: To, state?: any): void;
    /**
     * Navigates `n` entries backward/forward in the history stack relative to the
     * current index. For example, a "back" navigation would use go(-1).
     *
     * @param delta - The delta in the stack index
     */
    go(delta: number): void;
    /**
     * Sets up a listener that will be called whenever the current location
     * changes.
     *
     * @param listener - A function that will be called when the location changes
     * @returns unlisten - A function that may be used to stop listening
     */
    listen(listener: Listener): () => void;
}
/**
 * A user-supplied object that describes a location. Used when providing
 * entries to `createMemoryHistory` via its `initialEntries` option.
 */
type InitialEntry = string | Partial<Location>;
/**
 * A browser history stores the current location in regular URLs in a web
 * browser environment. This is the standard for most web apps and provides the
 * cleanest URLs the browser's address bar.
 *
 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#browserhistory
 */
interface BrowserHistory extends UrlHistory {
}
type BrowserHistoryOptions = UrlHistoryOptions;
/**
 * Browser history stores the location in regular URLs. This is the standard for
 * most web apps, but it requires some configuration on the server to ensure you
 * serve the same app at multiple URLs.
 *
 * @see https://github.com/remix-run/history/tree/main/docs/api-reference.md#createbrowserhistory
 */
declare function createBrowserHistory(options?: BrowserHistoryOptions): BrowserHistory;
/**
 * @private
 */
declare function invariant(value: boolean, message?: string): asserts value;
declare function invariant<T>(value: T | null | undefined, message?: string): asserts value is T;
/**
 * Creates a string URL path from the given pathname, search, and hash components.
 *
 * @category Utils
 */
declare function createPath({ pathname, search, hash, }: Partial<Path>): string;
/**
 * Parses a string URL path into its separate pathname, search, and hash components.
 *
 * @category Utils
 */
declare function parsePath(path: string): Partial<Path>;
interface UrlHistory extends History {
}
type UrlHistoryOptions = {
    window?: Window;
    v5Compat?: boolean;
};

/**
 * An augmentable interface users can modify in their app-code to opt into
 * future-flag-specific types
 */
interface Future {
}
type MiddlewareEnabled = Future extends {
    v8_middleware: infer T extends boolean;
} ? T : false;

type MaybePromise<T> = T | Promise<T>;
/**
 * Map of routeId -> data returned from a loader/action/error
 */
interface RouteData {
    [routeId: string]: any;
}
type LowerCaseFormMethod = "get" | "post" | "put" | "patch" | "delete";
type UpperCaseFormMethod = Uppercase<LowerCaseFormMethod>;
/**
 * Users can specify either lowercase or uppercase form methods on `<Form>`,
 * useSubmit(), `<fetcher.Form>`, etc.
 */
type HTMLFormMethod = LowerCaseFormMethod | UpperCaseFormMethod;
/**
 * Active navigation/fetcher form methods are exposed in uppercase on the
 * RouterState. This is to align with the normalization done via fetch().
 */
type FormMethod = UpperCaseFormMethod;
type FormEncType = "application/x-www-form-urlencoded" | "multipart/form-data" | "application/json" | "text/plain";
type JsonObject = {
    [Key in string]: JsonValue;
} & {
    [Key in string]?: JsonValue | undefined;
};
type JsonArray = JsonValue[] | readonly JsonValue[];
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
/**
 * @private
 * Internal interface to pass around for action submissions, not intended for
 * external consumption
 */
type Submission = {
    formMethod: FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: FormData;
    json: undefined;
    text: undefined;
} | {
    formMethod: FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: undefined;
    json: JsonValue;
    text: undefined;
} | {
    formMethod: FormMethod;
    formAction: string;
    formEncType: FormEncType;
    formData: undefined;
    json: undefined;
    text: string;
};
/**
 * A context instance used as the key for the `get`/`set` methods of a
 * {@link RouterContextProvider}. Accepts an optional default
 * value to be returned if no value has been set.
 */
interface RouterContext<T = unknown> {
    defaultValue?: T;
}
/**
 * Creates a type-safe {@link RouterContext} object that can be used to
 * store and retrieve arbitrary values in [`action`](../../start/framework/route-module#action)s,
 * [`loader`](../../start/framework/route-module#loader)s, and [middleware](../../how-to/middleware).
 * Similar to React's [`createContext`](https://react.dev/reference/react/createContext),
 * but specifically designed for React Router's request/response lifecycle.
 *
 * If a `defaultValue` is provided, it will be returned from `context.get()`
 * when no value has been set for the context. Otherwise, reading this context
 * when no value has been set will throw an error.
 *
 * ```tsx filename=app/context.ts
 * import { createContext } from "react-router";
 *
 * // Create a context for user data
 * export const userContext =
 *   createContext<User | null>(null);
 * ```
 *
 * ```tsx filename=app/middleware/auth.ts
 * import { getUserFromSession } from "~/auth.server";
 * import { userContext } from "~/context";
 *
 * export const authMiddleware = async ({
 *   context,
 *   request,
 * }) => {
 *   const user = await getUserFromSession(request);
 *   context.set(userContext, user);
 * };
 * ```
 *
 * ```tsx filename=app/routes/profile.tsx
 * import { userContext } from "~/context";
 *
 * export async function loader({
 *   context,
 * }: Route.LoaderArgs) {
 *   const user = context.get(userContext);
 *
 *   if (!user) {
 *     throw new Response("Unauthorized", { status: 401 });
 *   }
 *
 *   return { user };
 * }
 * ```
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param defaultValue An optional default value for the context. This value
 * will be returned if no value has been set for this context.
 * @returns A {@link RouterContext} object that can be used with
 * `context.get()` and `context.set()` in [`action`](../../start/framework/route-module#action)s,
 * [`loader`](../../start/framework/route-module#loader)s, and [middleware](../../how-to/middleware).
 */
declare function createContext<T>(defaultValue?: T): RouterContext<T>;
/**
 * Provides methods for writing/reading values in application context in a
 * type-safe way. Primarily for usage with [middleware](../../how-to/middleware).
 *
 * @example
 * import {
 *   createContext,
 *   RouterContextProvider
 * } from "react-router";
 *
 * const userContext = createContext<User | null>(null);
 * const contextProvider = new RouterContextProvider();
 * contextProvider.set(userContext, getUser());
 * //                               ^ Type-safe
 * const user = contextProvider.get(userContext);
 * //    ^ User
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 */
declare class RouterContextProvider {
    #private;
    /**
     * Create a new `RouterContextProvider` instance
     * @param init An optional initial context map to populate the provider with
     */
    constructor(init?: Map<RouterContext, unknown>);
    /**
     * Access a value from the context. If no value has been set for the context,
     * it will return the context's `defaultValue` if provided, or throw an error
     * if no `defaultValue` was set.
     * @param context The context to get the value for
     * @returns The value for the context, or the context's `defaultValue` if no
     * value was set
     */
    get<T>(context: RouterContext<T>): T;
    /**
     * Set a value for the context. If the context already has a value set, this
     * will overwrite it.
     *
     * @param context The context to set the value for
     * @param value The value to set for the context
     * @returns {void}
     */
    set<C extends RouterContext>(context: C, value: C extends RouterContext<infer T> ? T : never): void;
}
type DefaultContext = MiddlewareEnabled extends true ? Readonly<RouterContextProvider> : any;
/**
 * @private
 * Arguments passed to route loader/action functions.  Same for now but we keep
 * this as a private implementation detail in case they diverge in the future.
 */
interface DataFunctionArgs<Context> {
    /** A {@link https://developer.mozilla.org/en-US/docs/Web/API/Request Fetch Request instance} which you can use to read headers (like cookies, and {@link https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams URLSearchParams} from the request. */
    request: Request;
    /**
     * {@link https://reactrouter.com/start/framework/routing#dynamic-segments Dynamic route params} for the current route.
     * @example
     * // app/routes.ts
     * route("teams/:teamId", "./team.tsx"),
     *
     * // app/team.tsx
     * export function loader({
     *   params,
     * }: Route.LoaderArgs) {
     *   params.teamId;
     *   //        ^ string
     * }
     */
    params: Params;
    /**
     * This is the context passed in to your server adapter's getLoadContext() function.
     * It's a way to bridge the gap between the adapter's request/response API with your React Router app.
     * It is only applicable if you are using a custom server adapter.
     */
    context: Context;
}
/**
 * Route middleware `next` function to call downstream handlers and then complete
 * middlewares from the bottom-up
 */
interface MiddlewareNextFunction<Result = unknown> {
    (): Promise<Result>;
}
/**
 * Route middleware function signature.  Receives the same "data" arguments as a
 * `loader`/`action` (`request`, `params`, `context`) as the first parameter and
 * a `next` function as the second parameter which will call downstream handlers
 * and then complete middlewares from the bottom-up
 */
type MiddlewareFunction<Result = unknown> = (args: DataFunctionArgs<Readonly<RouterContextProvider>>, next: MiddlewareNextFunction<Result>) => MaybePromise<Result | void>;
/**
 * Arguments passed to loader functions
 */
interface LoaderFunctionArgs<Context = DefaultContext> extends DataFunctionArgs<Context> {
}
/**
 * Arguments passed to action functions
 */
interface ActionFunctionArgs<Context = DefaultContext> extends DataFunctionArgs<Context> {
}
/**
 * Loaders and actions can return anything
 */
type DataFunctionValue = unknown;
type DataFunctionReturnValue = MaybePromise<DataFunctionValue>;
/**
 * Route loader function signature
 */
type LoaderFunction<Context = DefaultContext> = {
    (args: LoaderFunctionArgs<Context>, handlerCtx?: unknown): DataFunctionReturnValue;
} & {
    hydrate?: boolean;
};
/**
 * Route action function signature
 */
interface ActionFunction<Context = DefaultContext> {
    (args: ActionFunctionArgs<Context>, handlerCtx?: unknown): DataFunctionReturnValue;
}
/**
 * Arguments passed to shouldRevalidate function
 */
interface ShouldRevalidateFunctionArgs {
    /** This is the url the navigation started from. You can compare it with `nextUrl` to decide if you need to revalidate this route's data. */
    currentUrl: URL;
    /** These are the {@link https://reactrouter.com/start/framework/routing#dynamic-segments dynamic route params} from the URL that can be compared to the `nextParams` to decide if you need to reload or not. Perhaps you're using only a partial piece of the param for data loading, you don't need to revalidate if a superfluous part of the param changed. */
    currentParams: AgnosticDataRouteMatch["params"];
    /** In the case of navigation, this the URL the user is requesting. Some revalidations are not navigation, so it will simply be the same as currentUrl. */
    nextUrl: URL;
    /** In the case of navigation, these are the {@link https://reactrouter.com/start/framework/routing#dynamic-segments dynamic route params}  from the next location the user is requesting. Some revalidations are not navigation, so it will simply be the same as currentParams. */
    nextParams: AgnosticDataRouteMatch["params"];
    /** The method (probably `"GET"` or `"POST"`) used in the form submission that triggered the revalidation. */
    formMethod?: Submission["formMethod"];
    /** The form action (`<Form action="/somewhere">`) that triggered the revalidation. */
    formAction?: Submission["formAction"];
    /** The form encType (`<Form encType="application/x-www-form-urlencoded">) used in the form submission that triggered the revalidation*/
    formEncType?: Submission["formEncType"];
    /** The form submission data when the form's encType is `text/plain` */
    text?: Submission["text"];
    /** The form submission data when the form's encType is `application/x-www-form-urlencoded` or `multipart/form-data` */
    formData?: Submission["formData"];
    /** The form submission data when the form's encType is `application/json` */
    json?: Submission["json"];
    /** The status code of the action response */
    actionStatus?: number;
    /**
     * When a submission causes the revalidation this will be the result of the action—either action data or an error if the action failed. It's common to include some information in the action result to instruct shouldRevalidate to revalidate or not.
     *
     * @example
     * export async function action() {
     *   await saveSomeStuff();
     *   return { ok: true };
     * }
     *
     * export function shouldRevalidate({
     *   actionResult,
     * }) {
     *   if (actionResult?.ok) {
     *     return false;
     *   }
     *   return true;
     * }
     */
    actionResult?: any;
    /**
     * By default, React Router doesn't call every loader all the time. There are reliable optimizations it can make by default. For example, only loaders with changing params are called. Consider navigating from the following URL to the one below it:
     *
     * /projects/123/tasks/abc
     * /projects/123/tasks/def
     * React Router will only call the loader for tasks/def because the param for projects/123 didn't change.
     *
     * It's safest to always return defaultShouldRevalidate after you've done your specific optimizations that return false, otherwise your UI might get out of sync with your data on the server.
     */
    defaultShouldRevalidate: boolean;
}
/**
 * Route shouldRevalidate function signature.  This runs after any submission
 * (navigation or fetcher), so we flatten the navigation/fetcher submission
 * onto the arguments.  It shouldn't matter whether it came from a navigation
 * or a fetcher, what really matters is the URLs and the formData since loaders
 * have to re-run based on the data models that were potentially mutated.
 */
interface ShouldRevalidateFunction {
    (args: ShouldRevalidateFunctionArgs): boolean;
}
interface DataStrategyMatch extends AgnosticRouteMatch<string, AgnosticDataRouteObject> {
    /**
     * @private
     */
    _lazyPromises?: {
        middleware: Promise<void> | undefined;
        handler: Promise<void> | undefined;
        route: Promise<void> | undefined;
    };
    /**
     * A boolean value indicating whether this route handler should be called in
     * this pass.
     *
     * The `matches` array always includes _all_ matched routes even when only
     * _some_ route handlers need to be called so that things like middleware can
     * be implemented.
     *
     * `shouldLoad` is usually only interesting if you are skipping the route
     * handler entirely and implementing custom handler logic - since it lets you
     * determine if that custom logic should run for this route or not.
     *
     * For example:
     *  - If you are on `/parent/child/a` and you navigate to `/parent/child/b` -
     *    you'll get an array of three matches (`[parent, child, b]`), but only `b`
     *    will have `shouldLoad=true` because the data for `parent` and `child` is
     *    already loaded
     *  - If you are on `/parent/child/a` and you submit to `a`'s [`action`](https://reactrouter.com/docs/start/data/route-object#action),
     *    then only `a` will have `shouldLoad=true` for the action execution of
     *    `dataStrategy`
     *  - After the [`action`](https://reactrouter.com/docs/start/data/route-object#action),
     *    `dataStrategy` will be called again for the [`loader`](https://reactrouter.com/docs/start/data/route-object#loader)
     *    revalidation, and all matches will have `shouldLoad=true` (assuming no
     *    custom `shouldRevalidate` implementations)
     */
    shouldLoad: boolean;
    unstable_shouldRevalidateArgs: ShouldRevalidateFunctionArgs | null;
    unstable_shouldCallHandler(defaultShouldRevalidate?: boolean): boolean;
    /**
     * An async function that will resolve any `route.lazy` implementations and
     * execute the route's handler (if necessary), returning a {@link DataStrategyResult}
     *
     * - Calling `match.resolve` does not mean you're calling the
     *   [`action`](https://reactrouter.com/docs/start/data/route-object#action)/[`loader`](https://reactrouter.com/docs/start/data/route-object#loader)
     *   (the "handler") - `resolve` will only call the `handler` internally if
     *   needed _and_ if you don't pass your own `handlerOverride` function parameter
     * - It is safe to call `match.resolve` for all matches, even if they have
     *   `shouldLoad=false`, and it will no-op if no loading is required
     * - You should generally always call `match.resolve()` for `shouldLoad:true`
     *   routes to ensure that any `route.lazy` implementations are processed
     * - See the examples below for how to implement custom handler execution via
     *   `match.resolve`
     */
    resolve: (handlerOverride?: (handler: (ctx?: unknown) => DataFunctionReturnValue) => DataFunctionReturnValue) => Promise<DataStrategyResult>;
}
interface DataStrategyFunctionArgs<Context = DefaultContext> extends DataFunctionArgs<Context> {
    /**
     * Matches for this route extended with Data strategy APIs
     */
    matches: DataStrategyMatch[];
    runClientMiddleware: (cb: DataStrategyFunction<Context>) => Promise<Record<string, DataStrategyResult>>;
    /**
     * The key of the fetcher we are calling `dataStrategy` for, otherwise `null`
     * for navigational executions
     */
    fetcherKey: string | null;
}
/**
 * Result from a loader or action called via dataStrategy
 */
interface DataStrategyResult {
    type: "data" | "error";
    result: unknown;
}
interface DataStrategyFunction<Context = DefaultContext> {
    (args: DataStrategyFunctionArgs<Context>): Promise<Record<string, DataStrategyResult>>;
}
type AgnosticPatchRoutesOnNavigationFunctionArgs<O extends AgnosticRouteObject = AgnosticRouteObject, M extends AgnosticRouteMatch = AgnosticRouteMatch> = {
    signal: AbortSignal;
    path: string;
    matches: M[];
    fetcherKey: string | undefined;
    patch: (routeId: string | null, children: O[]) => void;
};
type AgnosticPatchRoutesOnNavigationFunction<O extends AgnosticRouteObject = AgnosticRouteObject, M extends AgnosticRouteMatch = AgnosticRouteMatch> = (opts: AgnosticPatchRoutesOnNavigationFunctionArgs<O, M>) => MaybePromise<void>;
/**
 * Function provided by the framework-aware layers to set any framework-specific
 * properties from framework-agnostic properties
 */
interface MapRoutePropertiesFunction {
    (route: AgnosticRouteObject): {
        hasErrorBoundary: boolean;
    } & Record<string, any>;
}
/**
 * Keys we cannot change from within a lazy object. We spread all other keys
 * onto the route. Either they're meaningful to the router, or they'll get
 * ignored.
 */
type UnsupportedLazyRouteObjectKey = "lazy" | "caseSensitive" | "path" | "id" | "index" | "children";
/**
 * Keys we cannot change from within a lazy() function. We spread all other keys
 * onto the route. Either they're meaningful to the router, or they'll get
 * ignored.
 */
type UnsupportedLazyRouteFunctionKey = UnsupportedLazyRouteObjectKey | "middleware";
/**
 * lazy object to load route properties, which can add non-matching
 * related properties to a route
 */
type LazyRouteObject<R extends AgnosticRouteObject> = {
    [K in keyof R as K extends UnsupportedLazyRouteObjectKey ? never : K]?: () => Promise<R[K] | null | undefined>;
};
/**
 * lazy() function to load a route definition, which can add non-matching
 * related properties to a route
 */
interface LazyRouteFunction<R extends AgnosticRouteObject> {
    (): Promise<Omit<R, UnsupportedLazyRouteFunctionKey> & Partial<Record<UnsupportedLazyRouteFunctionKey, never>>>;
}
type LazyRouteDefinition<R extends AgnosticRouteObject> = LazyRouteObject<R> | LazyRouteFunction<R>;
/**
 * Base RouteObject with common props shared by all types of routes
 */
type AgnosticBaseRouteObject = {
    caseSensitive?: boolean;
    path?: string;
    id?: string;
    middleware?: MiddlewareFunction[];
    loader?: LoaderFunction | boolean;
    action?: ActionFunction | boolean;
    hasErrorBoundary?: boolean;
    shouldRevalidate?: ShouldRevalidateFunction;
    handle?: any;
    lazy?: LazyRouteDefinition<AgnosticBaseRouteObject>;
};
/**
 * Index routes must not have children
 */
type AgnosticIndexRouteObject = AgnosticBaseRouteObject & {
    children?: undefined;
    index: true;
};
/**
 * Non-index routes may have children, but cannot have index
 */
type AgnosticNonIndexRouteObject = AgnosticBaseRouteObject & {
    children?: AgnosticRouteObject[];
    index?: false;
};
/**
 * A route object represents a logical route, with (optionally) its child
 * routes organized in a tree-like structure.
 */
type AgnosticRouteObject = AgnosticIndexRouteObject | AgnosticNonIndexRouteObject;
type AgnosticDataIndexRouteObject = AgnosticIndexRouteObject & {
    id: string;
};
type AgnosticDataNonIndexRouteObject = AgnosticNonIndexRouteObject & {
    children?: AgnosticDataRouteObject[];
    id: string;
};
/**
 * A data route object, which is just a RouteObject with a required unique ID
 */
type AgnosticDataRouteObject = AgnosticDataIndexRouteObject | AgnosticDataNonIndexRouteObject;
type RouteManifest<R = AgnosticDataRouteObject> = Record<string, R | undefined>;
type Regex_az = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" | "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z";
type Regez_AZ = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
type Regex_09 = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type Regex_w = Regex_az | Regez_AZ | Regex_09 | "_";
type ParamChar = Regex_w | "-";
type RegexMatchPlus<CharPattern extends string, T extends string> = T extends `${infer First}${infer Rest}` ? First extends CharPattern ? RegexMatchPlus<CharPattern, Rest> extends never ? First : `${First}${RegexMatchPlus<CharPattern, Rest>}` : never : never;
type _PathParam<Path extends string> = Path extends `${infer L}/${infer R}` ? _PathParam<L> | _PathParam<R> : Path extends `:${infer Param}` ? Param extends `${infer Optional}?${string}` ? RegexMatchPlus<ParamChar, Optional> : RegexMatchPlus<ParamChar, Param> : never;
type PathParam<Path extends string> = Path extends "*" | "/*" ? "*" : Path extends `${infer Rest}/*` ? "*" | _PathParam<Rest> : _PathParam<Path>;
type ParamParseKey<Segment extends string> = [
    PathParam<Segment>
] extends [never] ? string : PathParam<Segment>;
/**
 * The parameters that were parsed from the URL path.
 */
type Params<Key extends string = string> = {
    readonly [key in Key]: string | undefined;
};
/**
 * A RouteMatch contains info about how a route matched a URL.
 */
interface AgnosticRouteMatch<ParamKey extends string = string, RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject> {
    /**
     * The names and values of dynamic parameters in the URL.
     */
    params: Params<ParamKey>;
    /**
     * The portion of the URL pathname that was matched.
     */
    pathname: string;
    /**
     * The portion of the URL pathname that was matched before child routes.
     */
    pathnameBase: string;
    /**
     * The route object that was used to match.
     */
    route: RouteObjectType;
}
interface AgnosticDataRouteMatch extends AgnosticRouteMatch<string, AgnosticDataRouteObject> {
}
/**
 * Matches the given routes to a location and returns the match data.
 *
 * @example
 * import { matchRoutes } from "react-router";
 *
 * let routes = [{
 *   path: "/",
 *   Component: Root,
 *   children: [{
 *     path: "dashboard",
 *     Component: Dashboard,
 *   }]
 * }];
 *
 * matchRoutes(routes, "/dashboard"); // [rootMatch, dashboardMatch]
 *
 * @public
 * @category Utils
 * @param routes The array of route objects to match against.
 * @param locationArg The location to match against, either a string path or a
 * partial {@link Location} object
 * @param basename Optional base path to strip from the location before matching.
 * Defaults to `/`.
 * @returns An array of matched routes, or `null` if no matches were found.
 */
declare function matchRoutes<RouteObjectType extends AgnosticRouteObject = AgnosticRouteObject>(routes: RouteObjectType[], locationArg: Partial<Location> | string, basename?: string): AgnosticRouteMatch<string, RouteObjectType>[] | null;
interface UIMatch<Data = unknown, Handle = unknown> {
    id: string;
    pathname: string;
    /**
     * {@link https://reactrouter.com/start/framework/routing#dynamic-segments Dynamic route params} for the matched route.
     */
    params: AgnosticRouteMatch["params"];
    /**
     * The return value from the matched route's loader or clientLoader. This might
     * be `undefined` if this route's `loader` (or a deeper route's `loader`) threw
     * an error and we're currently displaying an `ErrorBoundary`.
     *
     * @deprecated Use `UIMatch.loaderData` instead
     */
    data: Data | undefined;
    /**
     * The return value from the matched route's loader or clientLoader. This might
     * be `undefined` if this route's `loader` (or a deeper route's `loader`) threw
     * an error and we're currently displaying an `ErrorBoundary`.
     */
    loaderData: Data | undefined;
    /**
     * The {@link https://reactrouter.com/start/framework/route-module#handle handle object}
     * exported from the matched route module
     */
    handle: Handle;
}
/**
 * Returns a path with params interpolated.
 *
 * @example
 * import { generatePath } from "react-router";
 *
 * generatePath("/users/:id", { id: "123" }); // "/users/123"
 *
 * @public
 * @category Utils
 * @param originalPath The original path to generate.
 * @param params The parameters to interpolate into the path.
 * @returns The generated path with parameters interpolated.
 */
declare function generatePath<Path extends string>(originalPath: Path, params?: {
    [key in PathParam<Path>]: string | null;
}): string;
/**
 * Used to match on some portion of a URL pathname.
 */
interface PathPattern<Path extends string = string> {
    /**
     * A string to match against a URL pathname. May contain `:id`-style segments
     * to indicate placeholders for dynamic parameters. It May also end with `/*`
     * to indicate matching the rest of the URL pathname.
     */
    path: Path;
    /**
     * Should be `true` if the static portions of the `path` should be matched in
     * the same case.
     */
    caseSensitive?: boolean;
    /**
     * Should be `true` if this pattern should match the entire URL pathname.
     */
    end?: boolean;
}
/**
 * Contains info about how a {@link PathPattern} matched on a URL pathname.
 */
interface PathMatch<ParamKey extends string = string> {
    /**
     * The names and values of dynamic parameters in the URL.
     */
    params: Params<ParamKey>;
    /**
     * The portion of the URL pathname that was matched.
     */
    pathname: string;
    /**
     * The portion of the URL pathname that was matched before child routes.
     */
    pathnameBase: string;
    /**
     * The pattern that was used to match.
     */
    pattern: PathPattern;
}
/**
 * Performs pattern matching on a URL pathname and returns information about
 * the match.
 *
 * @public
 * @category Utils
 * @param pattern The pattern to match against the URL pathname. This can be a
 * string or a {@link PathPattern} object. If a string is provided, it will be
 * treated as a pattern with `caseSensitive` set to `false` and `end` set to
 * `true`.
 * @param pathname The URL pathname to match against the pattern.
 * @returns A path match object if the pattern matches the pathname,
 * or `null` if it does not match.
 */
declare function matchPath<ParamKey extends ParamParseKey<Path>, Path extends string>(pattern: PathPattern<Path> | Path, pathname: string): PathMatch<ParamKey> | null;
/**
 * Returns a resolved {@link Path} object relative to the given pathname.
 *
 * @public
 * @category Utils
 * @param to The path to resolve, either a string or a partial {@link Path}
 * object.
 * @param fromPathname The pathname to resolve the path from. Defaults to `/`.
 * @returns A {@link Path} object with the resolved pathname, search, and hash.
 */
declare function resolvePath(to: To, fromPathname?: string): Path;
declare class DataWithResponseInit<D> {
    type: string;
    data: D;
    init: ResponseInit | null;
    constructor(data: D, init?: ResponseInit);
}
/**
 * Create "responses" that contain `headers`/`status` without forcing
 * serialization into an actual [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 *
 * @example
 * import { data } from "react-router";
 *
 * export async function action({ request }: Route.ActionArgs) {
 *   let formData = await request.formData();
 *   let item = await createItem(formData);
 *   return data(item, {
 *     headers: { "X-Custom-Header": "value" }
 *     status: 201,
 *   });
 * }
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param data The data to be included in the response.
 * @param init The status code or a `ResponseInit` object to be included in the
 * response.
 * @returns A {@link DataWithResponseInit} instance containing the data and
 * response init.
 */
declare function data<D>(data: D, init?: number | ResponseInit): DataWithResponseInit<D>;
interface TrackedPromise extends Promise<any> {
    _tracked?: boolean;
    _data?: any;
    _error?: any;
}
type RedirectFunction = (url: string, init?: number | ResponseInit) => Response;
/**
 * A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).
 * Sets the status code and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
 *
 * @example
 * import { redirect } from "react-router";
 *
 * export async function loader({ request }: Route.LoaderArgs) {
 *   if (!isLoggedIn(request))
 *     throw redirect("/login");
 *   }
 *
 *   // ...
 * }
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param url The URL to redirect to.
 * @param init The status code or a `ResponseInit` object to be included in the
 * response.
 * @returns A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header.
 */
declare const redirect: RedirectFunction;
/**
 * A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * that will force a document reload to the new location. Sets the status code
 * and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
 *
 * ```tsx filename=routes/logout.tsx
 * import { redirectDocument } from "react-router";
 *
 * import { destroySession } from "../sessions.server";
 *
 * export async function action({ request }: Route.ActionArgs) {
 *   let session = await getSession(request.headers.get("Cookie"));
 *   return redirectDocument("/", {
 *     headers: { "Set-Cookie": await destroySession(session) }
 *   });
 * }
 * ```
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param url The URL to redirect to.
 * @param init The status code or a `ResponseInit` object to be included in the
 * response.
 * @returns A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header.
 */
declare const redirectDocument: RedirectFunction;
/**
 * A redirect [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * that will perform a [`history.replaceState`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState)
 * instead of a [`history.pushState`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState)
 * for client-side navigation redirects. Sets the status code and the [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header. Defaults to [`302 Found`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/302).
 *
 * @example
 * import { replace } from "react-router";
 *
 * export async function loader() {
 *   return replace("/new-location");
 * }
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param url The URL to redirect to.
 * @param init The status code or a `ResponseInit` object to be included in the
 * response.
 * @returns A [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * object with the redirect status and [`Location`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Location)
 * header.
 */
declare const replace: RedirectFunction;
type ErrorResponse = {
    status: number;
    statusText: string;
    data: any;
};
declare class ErrorResponseImpl implements ErrorResponse {
    status: number;
    statusText: string;
    data: any;
    private error?;
    private internal;
    constructor(status: number, statusText: string | undefined, data: any, internal?: boolean);
}
/**
 * Check if the given error is an {@link ErrorResponse} generated from a 4xx/5xx
 * [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
 * thrown from an [`action`](../../start/framework/route-module#action)/[`loader`](../../start/framework/route-module#loader)
 *
 * @example
 * import { isRouteErrorResponse } from "react-router";
 *
 * export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
 *   if (isRouteErrorResponse(error)) {
 *     return (
 *       <>
 *         <p>Error: `${error.status}: ${error.statusText}`</p>
 *         <p>{error.data}</p>
 *       </>
 *     );
 *   }
 *
 *   return (
 *     <p>Error: {error instanceof Error ? error.message : "Unknown Error"}</p>
 *   );
 * }
 *
 * @public
 * @category Utils
 * @mode framework
 * @mode data
 * @param error The error to check.
 * @returns `true` if the error is an {@link ErrorResponse}, `false` otherwise.
 *
 */
declare function isRouteErrorResponse(error: any): error is ErrorResponse;

/**
 * A Router instance manages all navigation and data loading/mutations
 */
interface Router$1 {
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Return the basename for the router
     */
    get basename(): RouterInit["basename"];
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Return the future config for the router
     */
    get future(): FutureConfig;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Return the current state of the router
     */
    get state(): RouterState;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Return the routes for this router instance
     */
    get routes(): AgnosticDataRouteObject[];
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Return the window associated with the router
     */
    get window(): RouterInit["window"];
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Initialize the router, including adding history listeners and kicking off
     * initial data fetches.  Returns a function to cleanup listeners and abort
     * any in-progress loads
     */
    initialize(): Router$1;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Subscribe to router.state updates
     *
     * @param fn function to call with the new state
     */
    subscribe(fn: RouterSubscriber): () => void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Enable scroll restoration behavior in the router
     *
     * @param savedScrollPositions Object that will manage positions, in case
     *                             it's being restored from sessionStorage
     * @param getScrollPosition    Function to get the active Y scroll position
     * @param getKey               Function to get the key to use for restoration
     */
    enableScrollRestoration(savedScrollPositions: Record<string, number>, getScrollPosition: GetScrollPositionFunction, getKey?: GetScrollRestorationKeyFunction): () => void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Navigate forward/backward in the history stack
     * @param to Delta to move in the history stack
     */
    navigate(to: number): Promise<void>;
    /**
     * Navigate to the given path
     * @param to Path to navigate to
     * @param opts Navigation options (method, submission, etc.)
     */
    navigate(to: To | null, opts?: RouterNavigateOptions): Promise<void>;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Trigger a fetcher load/submission
     *
     * @param key     Fetcher key
     * @param routeId Route that owns the fetcher
     * @param href    href to fetch
     * @param opts    Fetcher options, (method, submission, etc.)
     */
    fetch(key: string, routeId: string, href: string | null, opts?: RouterFetchOptions): Promise<void>;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Trigger a revalidation of all current route loaders and fetcher loads
     */
    revalidate(): Promise<void>;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Utility function to create an href for the given location
     * @param location
     */
    createHref(location: Location | URL): string;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Utility function to URL encode a destination path according to the internal
     * history implementation
     * @param to
     */
    encodeLocation(to: To): Path;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Get/create a fetcher for the given key
     * @param key
     */
    getFetcher<TData = any>(key: string): Fetcher<TData>;
    /**
     * @internal
     * PRIVATE - DO NOT USE
     *
     * Reset the fetcher for a given key
     * @param key
     */
    resetFetcher(key: string, opts?: {
        reason?: unknown;
    }): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Delete the fetcher for a given key
     * @param key
     */
    deleteFetcher(key: string): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Cleanup listeners and abort any in-progress loads
     */
    dispose(): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Get a navigation blocker
     * @param key The identifier for the blocker
     * @param fn The blocker function implementation
     */
    getBlocker(key: string, fn: BlockerFunction): Blocker;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Delete a navigation blocker
     * @param key The identifier for the blocker
     */
    deleteBlocker(key: string): void;
    /**
     * @private
     * PRIVATE DO NOT USE
     *
     * Patch additional children routes into an existing parent route
     * @param routeId The parent route id or a callback function accepting `patch`
     *                to perform batch patching
     * @param children The additional children routes
     * @param unstable_allowElementMutations Allow mutation or route elements on
     *                                       existing routes. Intended for RSC-usage
     *                                       only.
     */
    patchRoutes(routeId: string | null, children: AgnosticRouteObject[], unstable_allowElementMutations?: boolean): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * HMR needs to pass in-flight route updates to React Router
     * TODO: Replace this with granular route update APIs (addRoute, updateRoute, deleteRoute)
     */
    _internalSetRoutes(routes: AgnosticRouteObject[]): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Cause subscribers to re-render.  This is used to force a re-render.
     */
    _internalSetStateDoNotUseOrYouWillBreakYourApp(state: Partial<RouterState>): void;
    /**
     * @private
     * PRIVATE - DO NOT USE
     *
     * Internal fetch AbortControllers accessed by unit tests
     */
    _internalFetchControllers: Map<string, AbortController>;
}
/**
 * State maintained internally by the router.  During a navigation, all states
 * reflect the "old" location unless otherwise noted.
 */
interface RouterState {
    /**
     * The action of the most recent navigation
     */
    historyAction: Action;
    /**
     * The current location reflected by the router
     */
    location: Location;
    /**
     * The current set of route matches
     */
    matches: AgnosticDataRouteMatch[];
    /**
     * Tracks whether we've completed our initial data load
     */
    initialized: boolean;
    /**
     * Current scroll position we should start at for a new view
     *  - number -> scroll position to restore to
     *  - false -> do not restore scroll at all (used during submissions/revalidations)
     *  - null -> don't have a saved position, scroll to hash or top of page
     */
    restoreScrollPosition: number | false | null;
    /**
     * Indicate whether this navigation should skip resetting the scroll position
     * if we are unable to restore the scroll position
     */
    preventScrollReset: boolean;
    /**
     * Tracks the state of the current navigation
     */
    navigation: Navigation;
    /**
     * Tracks any in-progress revalidations
     */
    revalidation: RevalidationState;
    /**
     * Data from the loaders for the current matches
     */
    loaderData: RouteData;
    /**
     * Data from the action for the current matches
     */
    actionData: RouteData | null;
    /**
     * Errors caught from loaders for the current matches
     */
    errors: RouteData | null;
    /**
     * Map of current fetchers
     */
    fetchers: Map<string, Fetcher>;
    /**
     * Map of current blockers
     */
    blockers: Map<string, Blocker>;
}
/**
 * Data that can be passed into hydrate a Router from SSR
 */
type HydrationState = Partial<Pick<RouterState, "loaderData" | "actionData" | "errors">>;
/**
 * Future flags to toggle new feature behavior
 */
interface FutureConfig {
}
/**
 * Initialization options for createRouter
 */
interface RouterInit {
    routes: AgnosticRouteObject[];
    history: History;
    basename?: string;
    getContext?: () => MaybePromise<RouterContextProvider>;
    mapRouteProperties?: MapRoutePropertiesFunction;
    future?: Partial<FutureConfig>;
    hydrationRouteProperties?: string[];
    hydrationData?: HydrationState;
    window?: Window;
    dataStrategy?: DataStrategyFunction;
    patchRoutesOnNavigation?: AgnosticPatchRoutesOnNavigationFunction;
}
/**
 * State returned from a server-side query() call
 */
interface StaticHandlerContext {
    basename: Router$1["basename"];
    location: RouterState["location"];
    matches: RouterState["matches"];
    loaderData: RouterState["loaderData"];
    actionData: RouterState["actionData"];
    errors: RouterState["errors"];
    statusCode: number;
    loaderHeaders: Record<string, Headers>;
    actionHeaders: Record<string, Headers>;
    _deepestRenderedBoundaryId?: string | null;
}
/**
 * A StaticHandler instance manages a singular SSR navigation/fetch event
 */
interface StaticHandler {
    dataRoutes: AgnosticDataRouteObject[];
    query(request: Request, opts?: {
        requestContext?: unknown;
        filterMatchesToLoad?: (match: AgnosticDataRouteMatch) => boolean;
        skipLoaderErrorBubbling?: boolean;
        skipRevalidation?: boolean;
        dataStrategy?: DataStrategyFunction<unknown>;
        generateMiddlewareResponse?: (query: (r: Request, args?: {
            filterMatchesToLoad?: (match: AgnosticDataRouteMatch) => boolean;
        }) => Promise<StaticHandlerContext | Response>) => MaybePromise<Response>;
    }): Promise<StaticHandlerContext | Response>;
    queryRoute(request: Request, opts?: {
        routeId?: string;
        requestContext?: unknown;
        dataStrategy?: DataStrategyFunction<unknown>;
        generateMiddlewareResponse?: (queryRoute: (r: Request) => Promise<Response>) => MaybePromise<Response>;
    }): Promise<any>;
}
type ViewTransitionOpts = {
    currentLocation: Location;
    nextLocation: Location;
};
/**
 * Subscriber function signature for changes to router state
 */
interface RouterSubscriber {
    (state: RouterState, opts: {
        deletedFetchers: string[];
        viewTransitionOpts?: ViewTransitionOpts;
        flushSync: boolean;
    }): void;
}
/**
 * Function signature for determining the key to be used in scroll restoration
 * for a given location
 */
interface GetScrollRestorationKeyFunction {
    (location: Location, matches: UIMatch[]): string | null;
}
/**
 * Function signature for determining the current scroll position
 */
interface GetScrollPositionFunction {
    (): number;
}
/**
 * - "route": relative to the route hierarchy so `..` means remove all segments
 * of the current route even if it has many. For example, a `route("posts/:id")`
 * would have both `:id` and `posts` removed from the url.
 * - "path": relative to the pathname so `..` means remove one segment of the
 * pathname. For example, a `route("posts/:id")` would have only `:id` removed
 * from the url.
 */
type RelativeRoutingType = "route" | "path";
type BaseNavigateOrFetchOptions = {
    preventScrollReset?: boolean;
    relative?: RelativeRoutingType;
    flushSync?: boolean;
};
type BaseNavigateOptions = BaseNavigateOrFetchOptions & {
    replace?: boolean;
    state?: any;
    fromRouteId?: string;
    viewTransition?: boolean;
};
type BaseSubmissionOptions = {
    formMethod?: HTMLFormMethod;
    formEncType?: FormEncType;
} & ({
    formData: FormData;
    body?: undefined;
} | {
    formData?: undefined;
    body: any;
});
/**
 * Options for a navigate() call for a normal (non-submission) navigation
 */
type LinkNavigateOptions = BaseNavigateOptions;
/**
 * Options for a navigate() call for a submission navigation
 */
type SubmissionNavigateOptions = BaseNavigateOptions & BaseSubmissionOptions;
/**
 * Options to pass to navigate() for a navigation
 */
type RouterNavigateOptions = LinkNavigateOptions | SubmissionNavigateOptions;
/**
 * Options for a fetch() load
 */
type LoadFetchOptions = BaseNavigateOrFetchOptions;
/**
 * Options for a fetch() submission
 */
type SubmitFetchOptions = BaseNavigateOrFetchOptions & BaseSubmissionOptions;
/**
 * Options to pass to fetch()
 */
type RouterFetchOptions = LoadFetchOptions | SubmitFetchOptions;
/**
 * Potential states for state.navigation
 */
type NavigationStates = {
    Idle: {
        state: "idle";
        location: undefined;
        formMethod: undefined;
        formAction: undefined;
        formEncType: undefined;
        formData: undefined;
        json: undefined;
        text: undefined;
    };
    Loading: {
        state: "loading";
        location: Location;
        formMethod: Submission["formMethod"] | undefined;
        formAction: Submission["formAction"] | undefined;
        formEncType: Submission["formEncType"] | undefined;
        formData: Submission["formData"] | undefined;
        json: Submission["json"] | undefined;
        text: Submission["text"] | undefined;
    };
    Submitting: {
        state: "submitting";
        location: Location;
        formMethod: Submission["formMethod"];
        formAction: Submission["formAction"];
        formEncType: Submission["formEncType"];
        formData: Submission["formData"];
        json: Submission["json"];
        text: Submission["text"];
    };
};
type Navigation = NavigationStates[keyof NavigationStates];
type RevalidationState = "idle" | "loading";
/**
 * Potential states for fetchers
 */
type FetcherStates<TData = any> = {
    /**
     * The fetcher is not calling a loader or action
     *
     * ```tsx
     * fetcher.state === "idle"
     * ```
     */
    Idle: {
        state: "idle";
        formMethod: undefined;
        formAction: undefined;
        formEncType: undefined;
        text: undefined;
        formData: undefined;
        json: undefined;
        /**
         * If the fetcher has never been called, this will be undefined.
         */
        data: TData | undefined;
    };
    /**
     * The fetcher is loading data from a {@link LoaderFunction | loader} from a
     * call to {@link FetcherWithComponents.load | `fetcher.load`}.
     *
     * ```tsx
     * // somewhere
     * <button onClick={() => fetcher.load("/some/route") }>Load</button>
     *
     * // the state will update
     * fetcher.state === "loading"
     * ```
     */
    Loading: {
        state: "loading";
        formMethod: Submission["formMethod"] | undefined;
        formAction: Submission["formAction"] | undefined;
        formEncType: Submission["formEncType"] | undefined;
        text: Submission["text"] | undefined;
        formData: Submission["formData"] | undefined;
        json: Submission["json"] | undefined;
        data: TData | undefined;
    };
    /**
      The fetcher is submitting to a {@link LoaderFunction} (GET) or {@link ActionFunction} (POST) from a {@link FetcherWithComponents.Form | `fetcher.Form`} or {@link FetcherWithComponents.submit | `fetcher.submit`}.
  
      ```tsx
      // somewhere
      <input
        onChange={e => {
          fetcher.submit(event.currentTarget.form, { method: "post" });
        }}
      />
  
      // the state will update
      fetcher.state === "submitting"
  
      // and formData will be available
      fetcher.formData
      ```
     */
    Submitting: {
        state: "submitting";
        formMethod: Submission["formMethod"];
        formAction: Submission["formAction"];
        formEncType: Submission["formEncType"];
        text: Submission["text"];
        formData: Submission["formData"];
        json: Submission["json"];
        data: TData | undefined;
    };
};
type Fetcher<TData = any> = FetcherStates<TData>[keyof FetcherStates<TData>];
interface BlockerBlocked {
    state: "blocked";
    reset: () => void;
    proceed: () => void;
    location: Location;
}
interface BlockerUnblocked {
    state: "unblocked";
    reset: undefined;
    proceed: undefined;
    location: undefined;
}
interface BlockerProceeding {
    state: "proceeding";
    reset: undefined;
    proceed: undefined;
    location: Location;
}
type Blocker = BlockerUnblocked | BlockerBlocked | BlockerProceeding;
type BlockerFunction = (args: {
    currentLocation: Location;
    nextLocation: Location;
    historyAction: Action;
}) => boolean;
declare const IDLE_NAVIGATION: NavigationStates["Idle"];
declare const IDLE_FETCHER: FetcherStates["Idle"];
declare const IDLE_BLOCKER: BlockerUnblocked;
/**
 * Create a router and listen to history POP navigations
 */
declare function createRouter(init: RouterInit): Router$1;
interface CreateStaticHandlerOptions {
    basename?: string;
    mapRouteProperties?: MapRoutePropertiesFunction;
    future?: {};
}

declare function mapRouteProperties(route: RouteObject): Partial<RouteObject> & {
    hasErrorBoundary: boolean;
};
declare const hydrationRouteProperties: (keyof RouteObject)[];
/**
 * @category Data Routers
 */
interface MemoryRouterOpts {
    /**
     * Basename path for the application.
     */
    basename?: string;
    /**
     * A function that returns an {@link RouterContextProvider} instance
     * which is provided as the `context` argument to client [`action`](../../start/data/route-object#action)s,
     * [`loader`](../../start/data/route-object#loader)s and [middleware](../../how-to/middleware).
     * This function is called to generate a fresh `context` instance on each
     * navigation or fetcher call.
     */
    getContext?: RouterInit["getContext"];
    /**
     * Future flags to enable for the router.
     */
    future?: Partial<FutureConfig>;
    /**
     * Hydration data to initialize the router with if you have already performed
     * data loading on the server.
     */
    hydrationData?: HydrationState;
    /**
     * Initial entries in the in-memory history stack
     */
    initialEntries?: InitialEntry[];
    /**
     * Index of `initialEntries` the application should initialize to
     */
    initialIndex?: number;
    /**
     * Override the default data strategy of loading in parallel.
     * Only intended for advanced usage.
     */
    dataStrategy?: DataStrategyFunction;
    /**
     * Lazily define portions of the route tree on navigations.
     */
    patchRoutesOnNavigation?: PatchRoutesOnNavigationFunction;
}
/**
 * Create a new {@link DataRouter} that manages the application path using an
 * in-memory [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
 * stack. Useful for non-browser environments without a DOM API.
 *
 * @public
 * @category Data Routers
 * @mode data
 * @param routes Application routes
 * @param opts Options
 * @param {MemoryRouterOpts.basename} opts.basename n/a
 * @param {MemoryRouterOpts.dataStrategy} opts.dataStrategy n/a
 * @param {MemoryRouterOpts.future} opts.future n/a
 * @param {MemoryRouterOpts.getContext} opts.getContext n/a
 * @param {MemoryRouterOpts.hydrationData} opts.hydrationData n/a
 * @param {MemoryRouterOpts.initialEntries} opts.initialEntries n/a
 * @param {MemoryRouterOpts.initialIndex} opts.initialIndex n/a
 * @param {MemoryRouterOpts.patchRoutesOnNavigation} opts.patchRoutesOnNavigation n/a
 * @returns An initialized {@link DataRouter} to pass to {@link RouterProvider | `<RouterProvider>`}
 */
declare function createMemoryRouter(routes: RouteObject[], opts?: MemoryRouterOpts): Router$1;
/**
 * Function signature for client side error handling for loader/actions errors
 * and rendering errors via `componentDidCatch`
 */
interface unstable_ClientOnErrorFunction {
    (error: unknown, errorInfo?: React.ErrorInfo): void;
}
/**
 * @category Types
 */
interface RouterProviderProps {
    /**
     * The {@link DataRouter} instance to use for navigation and data fetching.
     */
    router: Router$1;
    /**
     * The [`ReactDOM.flushSync`](https://react.dev/reference/react-dom/flushSync)
     * implementation to use for flushing updates.
     *
     * You usually don't have to worry about this:
     * - The `RouterProvider` exported from `react-router/dom` handles this internally for you
     * - If you are rendering in a non-DOM environment, you can import
     *   `RouterProvider` from `react-router` and ignore this prop
     */
    flushSync?: (fn: () => unknown) => undefined;
    /**
     * An error handler function that will be called for any loader/action/render
     * errors that are encountered in your application.  This is useful for
     * logging or reporting errors instead of the `ErrorBoundary` because it's not
     * subject to re-rendering and will only run one time per error.
     *
     * The `errorInfo` parameter is passed along from
     * [`componentDidCatch`](https://react.dev/reference/react/Component#componentdidcatch)
     * and is only present for render errors.
     *
     * ```tsx
     * <RouterProvider unstable_onError=(error, errorInfo) => {
     *   console.error(error, errorInfo);
     *   reportToErrorService(error, errorInfo);
     * }} />
     * ```
     */
    unstable_onError?: unstable_ClientOnErrorFunction;
}
/**
 * Render the UI for the given {@link DataRouter}. This component should
 * typically be at the top of an app's element tree.
 *
 * ```tsx
 * import { createBrowserRouter } from "react-router";
 * import { RouterProvider } from "react-router/dom";
 * import { createRoot } from "react-dom/client";
 *
 * const router = createBrowserRouter(routes);
 * createRoot(document.getElementById("root")).render(
 *   <RouterProvider router={router} />
 * );
 * ```
 *
 * <docs-info>Please note that this component is exported both from
 * `react-router` and `react-router/dom` with the only difference being that the
 * latter automatically wires up `react-dom`'s [`flushSync`](https://react.dev/reference/react-dom/flushSync)
 * implementation. You _almost always_ want to use the version from
 * `react-router/dom` unless you're running in a non-DOM environment.</docs-info>
 *
 *
 * @public
 * @category Data Routers
 * @mode data
 * @param props Props
 * @param {RouterProviderProps.flushSync} props.flushSync n/a
 * @param {RouterProviderProps.unstable_onError} props.unstable_onError n/a
 * @param {RouterProviderProps.router} props.router n/a
 * @returns React element for the rendered router
 */
declare function RouterProvider({ router, flushSync: reactDomFlushSyncImpl, unstable_onError, }: RouterProviderProps): React.ReactElement;
/**
 * @category Types
 */
interface MemoryRouterProps {
    /**
     * Application basename
     */
    basename?: string;
    /**
     * Nested {@link Route} elements describing the route tree
     */
    children?: React.ReactNode;
    /**
     * Initial entries in the in-memory history stack
     */
    initialEntries?: InitialEntry[];
    /**
     * Index of `initialEntries` the application should initialize to
     */
    initialIndex?: number;
}
/**
 * A declarative {@link Router | `<Router>`} that stores all entries in memory.
 *
 * @public
 * @category Declarative Routers
 * @mode declarative
 * @param props Props
 * @param {MemoryRouterProps.basename} props.basename n/a
 * @param {MemoryRouterProps.children} props.children n/a
 * @param {MemoryRouterProps.initialEntries} props.initialEntries n/a
 * @param {MemoryRouterProps.initialIndex} props.initialIndex n/a
 * @returns A declarative in-memory {@link Router | `<Router>`} for client-side
 * routing.
 */
declare function MemoryRouter({ basename, children, initialEntries, initialIndex, }: MemoryRouterProps): React.ReactElement;
/**
 * @category Types
 */
interface NavigateProps {
    /**
     * The path to navigate to. This can be a string or a {@link Path} object
     */
    to: To;
    /**
     * Whether to replace the current entry in the [`History`](https://developer.mozilla.org/en-US/docs/Web/API/History)
     * stack
     */
    replace?: boolean;
    /**
     * State to pass to the new {@link Location} to store in [`history.state`](https://developer.mozilla.org/en-US/docs/Web/API/History/state).
     */
    state?: any;
    /**
     * How to interpret relative routing in the `to` prop.
     * See {@link RelativeRoutingType}.
     */
    relative?: RelativeRoutingType;
}
/**
 * A component-based version of {@link useNavigate} to use in a
 * [`React.Component` class](https://react.dev/reference/react/Component) where
 * hooks cannot be used.
 *
 * It's recommended to avoid using this component in favor of {@link useNavigate}.
 *
 * @example
 * <Navigate to="/tasks" />
 *
 * @public
 * @category Components
 * @param props Props
 * @param {NavigateProps.relative} props.relative n/a
 * @param {NavigateProps.replace} props.replace n/a
 * @param {NavigateProps.state} props.state n/a
 * @param {NavigateProps.to} props.to n/a
 * @returns {void}
 *
 */
declare function Navigate({ to, replace, state, relative, }: NavigateProps): null;
/**
 * @category Types
 */
interface OutletProps {
    /**
     * Provides a context value to the element tree below the outlet. Use when
     * the parent route needs to provide values to child routes.
     *
     * ```tsx
     * <Outlet context={myContextValue} />
     * ```
     *
     * Access the context with {@link useOutletContext}.
     */
    context?: unknown;
}
/**
 * Renders the matching child route of a parent route or nothing if no child
 * route matches.
 *
 * @example
 * import { Outlet } from "react-router";
 *
 * export default function SomeParent() {
 *   return (
 *     <div>
 *       <h1>Parent Content</h1>
 *       <Outlet />
 *     </div>
 *   );
 * }
 *
 * @public
 * @category Components
 * @param props Props
 * @param {OutletProps.context} props.context n/a
 * @returns React element for the rendered outlet or `null` if no child route matches.
 */
declare function Outlet(props: OutletProps): React.ReactElement | null;
/**
 * @category Types
 */
interface PathRouteProps {
    /**
     * Whether the path should be case-sensitive. Defaults to `false`.
     */
    caseSensitive?: NonIndexRouteObject["caseSensitive"];
    /**
     * The path pattern to match. If unspecified or empty, then this becomes a
     * layout route.
     */
    path?: NonIndexRouteObject["path"];
    /**
     * The unique identifier for this route (for use with {@link DataRouter}s)
     */
    id?: NonIndexRouteObject["id"];
    /**
     * A function that returns a promise that resolves to the route object.
     * Used for code-splitting routes.
     * See [`lazy`](../../start/data/route-object#lazy).
     */
    lazy?: LazyRouteFunction<NonIndexRouteObject>;
    /**
     * The route middleware.
     * See [`middleware`](../../start/data/route-object#middleware).
     */
    middleware?: NonIndexRouteObject["middleware"];
    /**
     * The route loader.
     * See [`loader`](../../start/data/route-object#loader).
     */
    loader?: NonIndexRouteObject["loader"];
    /**
     * The route action.
     * See [`action`](../../start/data/route-object#action).
     */
    action?: NonIndexRouteObject["action"];
    hasErrorBoundary?: NonIndexRouteObject["hasErrorBoundary"];
    /**
     * The route shouldRevalidate function.
     * See [`shouldRevalidate`](../../start/data/route-object#shouldRevalidate).
     */
    shouldRevalidate?: NonIndexRouteObject["shouldRevalidate"];
    /**
     * The route handle.
     */
    handle?: NonIndexRouteObject["handle"];
    /**
     * Whether this is an index route.
     */
    index?: false;
    /**
     * Child Route components
     */
    children?: React.ReactNode;
    /**
     * The React element to render when this Route matches.
     * Mutually exclusive with `Component`.
     */
    element?: React.ReactNode | null;
    /**
     * The React element to render while this router is loading data.
     * Mutually exclusive with `HydrateFallback`.
     */
    hydrateFallbackElement?: React.ReactNode | null;
    /**
     * The React element to render at this route if an error occurs.
     * Mutually exclusive with `ErrorBoundary`.
     */
    errorElement?: React.ReactNode | null;
    /**
     * The React Component to render when this route matches.
     * Mutually exclusive with `element`.
     */
    Component?: React.ComponentType | null;
    /**
     * The React Component to render while this router is loading data.
     * Mutually exclusive with `hydrateFallbackElement`.
     */
    HydrateFallback?: React.ComponentType | null;
    /**
     * The React Component to render at this route if an error occurs.
     * Mutually exclusive with `errorElement`.
     */
    ErrorBoundary?: React.ComponentType | null;
}
/**
 * @category Types
 */
interface LayoutRouteProps extends PathRouteProps {
}
/**
 * @category Types
 */
interface IndexRouteProps {
    /**
     * Whether the path should be case-sensitive. Defaults to `false`.
     */
    caseSensitive?: IndexRouteObject["caseSensitive"];
    /**
     * The path pattern to match. If unspecified or empty, then this becomes a
     * layout route.
     */
    path?: IndexRouteObject["path"];
    /**
     * The unique identifier for this route (for use with {@link DataRouter}s)
     */
    id?: IndexRouteObject["id"];
    /**
     * A function that returns a promise that resolves to the route object.
     * Used for code-splitting routes.
     * See [`lazy`](../../start/data/route-object#lazy).
     */
    lazy?: LazyRouteFunction<IndexRouteObject>;
    /**
     * The route middleware.
     * See [`middleware`](../../start/data/route-object#middleware).
     */
    middleware?: IndexRouteObject["middleware"];
    /**
     * The route loader.
     * See [`loader`](../../start/data/route-object#loader).
     */
    loader?: IndexRouteObject["loader"];
    /**
     * The route action.
     * See [`action`](../../start/data/route-object#action).
     */
    action?: IndexRouteObject["action"];
    hasErrorBoundary?: IndexRouteObject["hasErrorBoundary"];
    /**
     * The route shouldRevalidate function.
     * See [`shouldRevalidate`](../../start/data/route-object#shouldRevalidate).
     */
    shouldRevalidate?: IndexRouteObject["shouldRevalidate"];
    /**
     * The route handle.
     */
    handle?: IndexRouteObject["handle"];
    /**
     * Whether this is an index route.
     */
    index: true;
    /**
     * Child Route components
     */
    children?: undefined;
    /**
     * The React element to render when this Route matches.
     * Mutually exclusive with `Component`.
     */
    element?: React.ReactNode | null;
    /**
     * The React element to render while this router is loading data.
     * Mutually exclusive with `HydrateFallback`.
     */
    hydrateFallbackElement?: React.ReactNode | null;
    /**
     * The React element to render at this route if an error occurs.
     * Mutually exclusive with `ErrorBoundary`.
     */
    errorElement?: React.ReactNode | null;
    /**
     * The React Component to render when this route matches.
     * Mutually exclusive with `element`.
     */
    Component?: React.ComponentType | null;
    /**
     * The React Component to render while this router is loading data.
     * Mutually exclusive with `hydrateFallbackElement`.
     */
    HydrateFallback?: React.ComponentType | null;
    /**
     * The React Component to render at this route if an error occurs.
     * Mutually exclusive with `errorElement`.
     */
    ErrorBoundary?: React.ComponentType | null;
}
type RouteProps = PathRouteProps | LayoutRouteProps | IndexRouteProps;
/**
 * Configures an element to render when a pattern matches the current location.
 * It must be rendered within a {@link Routes} element. Note that these routes
 * do not participate in data loading, actions, code splitting, or any other
 * route module features.
 *
 * @example
 * // Usually used in a declarative router
 * function App() {
 *   return (
 *     <BrowserRouter>
 *       <Routes>
 *         <Route index element={<StepOne />} />
 *         <Route path="step-2" element={<StepTwo />} />
 *         <Route path="step-3" element={<StepThree />} />
 *       </Routes>
 *    </BrowserRouter>
 *   );
 * }
 *
 * // But can be used with a data router as well if you prefer the JSX notation
 * const routes = createRoutesFromElements(
 *   <>
 *     <Route index loader={step1Loader} Component={StepOne} />
 *     <Route path="step-2" loader={step2Loader} Component={StepTwo} />
 *     <Route path="step-3" loader={step3Loader} Component={StepThree} />
 *   </>
 * );
 *
 * const router = createBrowserRouter(routes);
 *
 * function App() {
 *   return <RouterProvider router={router} />;
 * }
 *
 * @public
 * @category Components
 * @param props Props
 * @param {PathRouteProps.action} props.action n/a
 * @param {PathRouteProps.caseSensitive} props.caseSensitive n/a
 * @param {PathRouteProps.Component} props.Component n/a
 * @param {PathRouteProps.children} props.children n/a
 * @param {PathRouteProps.element} props.element n/a
 * @param {PathRouteProps.ErrorBoundary} props.ErrorBoundary n/a
 * @param {PathRouteProps.errorElement} props.errorElement n/a
 * @param {PathRouteProps.handle} props.handle n/a
 * @param {PathRouteProps.HydrateFallback} props.HydrateFallback n/a
 * @param {PathRouteProps.hydrateFallbackElement} props.hydrateFallbackElement n/a
 * @param {PathRouteProps.id} props.id n/a
 * @param {PathRouteProps.index} props.index n/a
 * @param {PathRouteProps.lazy} props.lazy n/a
 * @param {PathRouteProps.loader} props.loader n/a
 * @param {PathRouteProps.path} props.path n/a
 * @param {PathRouteProps.shouldRevalidate} props.shouldRevalidate n/a
 * @returns {void}
 */
declare function Route(props: RouteProps): React.ReactElement | null;
/**
 * @category Types
 */
interface RouterProps {
    /**
     * The base path for the application. This is prepended to all locations
     */
    basename?: string;
    /**
     * Nested {@link Route} elements describing the route tree
     */
    children?: React.ReactNode;
    /**
     * The location to match against. Defaults to the current location.
     * This can be a string or a {@link Location} object.
     */
    location: Partial<Location> | string;
    /**
     * The type of navigation that triggered this `location` change.
     * Defaults to {@link NavigationType.Pop}.
     */
    navigationType?: Action;
    /**
     * The navigator to use for navigation. This is usually a history object
     * or a custom navigator that implements the {@link Navigator} interface.
     */
    navigator: Navigator;
    /**
     * Whether this router is static or not (used for SSR). If `true`, the router
     * will not be reactive to location changes.
     */
    static?: boolean;
}
/**
 * Provides location context for the rest of the app.
 *
 * Note: You usually won't render a `<Router>` directly. Instead, you'll render a
 * router that is more specific to your environment such as a {@link BrowserRouter}
 * in web browsers or a {@link ServerRouter} for server rendering.
 *
 * @public
 * @category Declarative Routers
 * @mode declarative
 * @param props Props
 * @param {RouterProps.basename} props.basename n/a
 * @param {RouterProps.children} props.children n/a
 * @param {RouterProps.location} props.location n/a
 * @param {RouterProps.navigationType} props.navigationType n/a
 * @param {RouterProps.navigator} props.navigator n/a
 * @param {RouterProps.static} props.static n/a
 * @returns React element for the rendered router or `null` if the location does
 * not match the {@link props.basename}
 */
declare function Router({ basename: basenameProp, children, location: locationProp, navigationType, navigator, static: staticProp, }: RouterProps): React.ReactElement | null;
/**
 * @category Types
 */
interface RoutesProps {
    /**
     * Nested {@link Route} elements
     */
    children?: React.ReactNode;
    /**
     * The {@link Location} to match against. Defaults to the current location.
     */
    location?: Partial<Location> | string;
}
/**
 * Renders a branch of {@link Route | `<Route>`s} that best matches the current
 * location. Note that these routes do not participate in [data loading](../../start/framework/route-module#loader),
 * [`action`](../../start/framework/route-module#action), code splitting, or
 * any other [route module](../../start/framework/route-module) features.
 *
 * @example
 * import { Route, Routes } from "react-router";
 *
 * <Routes>
 *   <Route index element={<StepOne />} />
 *   <Route path="step-2" element={<StepTwo />} />
 *   <Route path="step-3" element={<StepThree />} />
 * </Routes>
 *
 * @public
 * @category Components
 * @param props Props
 * @param {RoutesProps.children} props.children n/a
 * @param {RoutesProps.location} props.location n/a
 * @returns React element for the rendered routes or `null` if no route matches
 */
declare function Routes({ children, location, }: RoutesProps): React.ReactElement | null;
interface AwaitResolveRenderFunction<Resolve = any> {
    (data: Awaited<Resolve>): React.ReactNode;
}
/**
 * @category Types
 */
interface AwaitProps<Resolve> {
    /**
     * When using a function, the resolved value is provided as the parameter.
     *
     * ```tsx [2]
     * <Await resolve={reviewsPromise}>
     *   {(resolvedReviews) => <Reviews items={resolvedReviews} />}
     * </Await>
     * ```
     *
     * When using React elements, {@link useAsyncValue} will provide the
     * resolved value:
     *
     * ```tsx [2]
     * <Await resolve={reviewsPromise}>
     *   <Reviews />
     * </Await>
     *
     * function Reviews() {
     *   const resolvedReviews = useAsyncValue();
     *   return <div>...</div>;
     * }
     * ```
     */
    children: React.ReactNode | AwaitResolveRenderFunction<Resolve>;
    /**
     * The error element renders instead of the `children` when the [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
     * rejects.
     *
     * ```tsx
     * <Await
     *   errorElement={<div>Oops</div>}
     *   resolve={reviewsPromise}
     * >
     *   <Reviews />
     * </Await>
     * ```
     *
     * To provide a more contextual error, you can use the {@link useAsyncError} in a
     * child component
     *
     * ```tsx
     * <Await
     *   errorElement={<ReviewsError />}
     *   resolve={reviewsPromise}
     * >
     *   <Reviews />
     * </Await>
     *
     * function ReviewsError() {
     *   const error = useAsyncError();
     *   return <div>Error loading reviews: {error.message}</div>;
     * }
     * ```
     *
     * If you do not provide an `errorElement`, the rejected value will bubble up
     * to the nearest route-level [`ErrorBoundary`](../../start/framework/route-module#errorboundary)
     * and be accessible via the {@link useRouteError} hook.
     */
    errorElement?: React.ReactNode;
    /**
     * Takes a [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise)
     * returned from a [`loader`](../../start/framework/route-module#loader) to be
     * resolved and rendered.
     *
     * ```tsx
     * import { Await, useLoaderData } from "react-router";
     *
     * export async function loader() {
     *   let reviews = getReviews(); // not awaited
     *   let book = await getBook();
     *   return {
     *     book,
     *     reviews, // this is a promise
     *   };
     * }
     *
     * export default function Book() {
     *   const {
     *     book,
     *     reviews, // this is the same promise
     *   } = useLoaderData();
     *
     *   return (
     *     <div>
     *       <h1>{book.title}</h1>
     *       <p>{book.description}</p>
     *       <React.Suspense fallback={<ReviewsSkeleton />}>
     *         <Await
     *           // and is the promise we pass to Await
     *           resolve={reviews}
     *         >
     *           <Reviews />
     *         </Await>
     *       </React.Suspense>
     *     </div>
     *   );
     * }
     * ```
     */
    resolve: Resolve;
}
/**
 * Used to render promise values with automatic error handling.
 *
 * **Note:** `<Await>` expects to be rendered inside a [`<React.Suspense>`](https://react.dev/reference/react/Suspense)
 *
 * @example
 * import { Await, useLoaderData } from "react-router";
 *
 * export async function loader() {
 *   // not awaited
 *   const reviews = getReviews();
 *   // awaited (blocks the transition)
 *   const book = await fetch("/api/book").then((res) => res.json());
 *   return { book, reviews };
 * }
 *
 * function Book() {
 *   const { book, reviews } = useLoaderData();
 *   return (
 *     <div>
 *       <h1>{book.title}</h1>
 *       <p>{book.description}</p>
 *       <React.Suspense fallback={<ReviewsSkeleton />}>
 *         <Await
 *           resolve={reviews}
 *           errorElement={
 *             <div>Could not load reviews 😬</div>
 *           }
 *           children={(resolvedReviews) => (
 *             <Reviews items={resolvedReviews} />
 *           )}
 *         />
 *       </React.Suspense>
 *     </div>
 *   );
 * }
 *
 * @public
 * @category Components
 * @mode framework
 * @mode data
 * @param props Props
 * @param {AwaitProps.children} props.children n/a
 * @param {AwaitProps.errorElement} props.errorElement n/a
 * @param {AwaitProps.resolve} props.resolve n/a
 * @returns React element for the rendered awaited value
 */
declare function Await<Resolve>({ children, errorElement, resolve, }: AwaitProps<Resolve>): React.JSX.Element;
/**
 * Creates a route config from a React "children" object, which is usually
 * either a `<Route>` element or an array of them. Used internally by
 * `<Routes>` to create a route config from its children.
 *
 * @category Utils
 * @mode data
 * @param children The React children to convert into a route config
 * @param parentPath The path of the parent route, used to generate unique IDs.
 * @returns An array of {@link RouteObject}s that can be used with a {@link DataRouter}
 */
declare function createRoutesFromChildren(children: React.ReactNode, parentPath?: number[]): RouteObject[];
/**
 * Create route objects from JSX elements instead of arrays of objects.
 *
 * @example
 * const routes = createRoutesFromElements(
 *   <>
 *     <Route index loader={step1Loader} Component={StepOne} />
 *     <Route path="step-2" loader={step2Loader} Component={StepTwo} />
 *     <Route path="step-3" loader={step3Loader} Component={StepThree} />
 *   </>
 * );
 *
 * const router = createBrowserRouter(routes);
 *
 * function App() {
 *   return <RouterProvider router={router} />;
 * }
 *
 * @name createRoutesFromElements
 * @public
 * @category Utils
 * @mode data
 * @param children The React children to convert into a route config
 * @param parentPath The path of the parent route, used to generate unique IDs.
 * This is used for internal recursion and is not intended to be used by the
 * application developer.
 * @returns An array of {@link RouteObject}s that can be used with a {@link DataRouter}
 */
declare const createRoutesFromElements: typeof createRoutesFromChildren;
/**
 * Renders the result of {@link matchRoutes} into a React element.
 *
 * @public
 * @category Utils
 * @param matches The array of {@link RouteMatch | route matches} to render
 * @returns A React element that renders the matched routes or `null` if no matches
 */
declare function renderMatches(matches: RouteMatch[] | null): React.ReactElement | null;
declare function useRouteComponentProps(): {
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
    matches: UIMatch<unknown, unknown>[];
};
type RouteComponentProps = ReturnType<typeof useRouteComponentProps>;
type RouteComponentType = React.ComponentType<RouteComponentProps>;
declare function WithComponentProps({ children, }: {
    children: React.ReactElement;
}): React.ReactElement<any, string | React.JSXElementConstructor<any>>;
declare function withComponentProps(Component: RouteComponentType): () => React.ReactElement<{
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
    matches: UIMatch<unknown, unknown>[];
}, string | React.JSXElementConstructor<any>>;
declare function useHydrateFallbackProps(): {
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
};
type HydrateFallbackProps = ReturnType<typeof useHydrateFallbackProps>;
type HydrateFallbackType = React.ComponentType<HydrateFallbackProps>;
declare function WithHydrateFallbackProps({ children, }: {
    children: React.ReactElement;
}): React.ReactElement<any, string | React.JSXElementConstructor<any>>;
declare function withHydrateFallbackProps(HydrateFallback: HydrateFallbackType): () => React.ReactElement<{
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
}, string | React.JSXElementConstructor<any>>;
declare function useErrorBoundaryProps(): {
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
    error: unknown;
};
type ErrorBoundaryProps = ReturnType<typeof useErrorBoundaryProps>;
type ErrorBoundaryType = React.ComponentType<ErrorBoundaryProps>;
declare function WithErrorBoundaryProps({ children, }: {
    children: React.ReactElement;
}): React.ReactElement<any, string | React.JSXElementConstructor<any>>;
declare function withErrorBoundaryProps(ErrorBoundary: ErrorBoundaryType): () => React.ReactElement<{
    params: Readonly<Params<string>>;
    loaderData: any;
    actionData: any;
    error: unknown;
}, string | React.JSXElementConstructor<any>>;

interface IndexRouteObject {
    caseSensitive?: AgnosticIndexRouteObject["caseSensitive"];
    path?: AgnosticIndexRouteObject["path"];
    id?: AgnosticIndexRouteObject["id"];
    middleware?: AgnosticIndexRouteObject["middleware"];
    loader?: AgnosticIndexRouteObject["loader"];
    action?: AgnosticIndexRouteObject["action"];
    hasErrorBoundary?: AgnosticIndexRouteObject["hasErrorBoundary"];
    shouldRevalidate?: AgnosticIndexRouteObject["shouldRevalidate"];
    handle?: AgnosticIndexRouteObject["handle"];
    index: true;
    children?: undefined;
    element?: React.ReactNode | null;
    hydrateFallbackElement?: React.ReactNode | null;
    errorElement?: React.ReactNode | null;
    Component?: React.ComponentType | null;
    HydrateFallback?: React.ComponentType | null;
    ErrorBoundary?: React.ComponentType | null;
    lazy?: LazyRouteDefinition<RouteObject>;
}
interface NonIndexRouteObject {
    caseSensitive?: AgnosticNonIndexRouteObject["caseSensitive"];
    path?: AgnosticNonIndexRouteObject["path"];
    id?: AgnosticNonIndexRouteObject["id"];
    middleware?: AgnosticNonIndexRouteObject["middleware"];
    loader?: AgnosticNonIndexRouteObject["loader"];
    action?: AgnosticNonIndexRouteObject["action"];
    hasErrorBoundary?: AgnosticNonIndexRouteObject["hasErrorBoundary"];
    shouldRevalidate?: AgnosticNonIndexRouteObject["shouldRevalidate"];
    handle?: AgnosticNonIndexRouteObject["handle"];
    index?: false;
    children?: RouteObject[];
    element?: React.ReactNode | null;
    hydrateFallbackElement?: React.ReactNode | null;
    errorElement?: React.ReactNode | null;
    Component?: React.ComponentType | null;
    HydrateFallback?: React.ComponentType | null;
    ErrorBoundary?: React.ComponentType | null;
    lazy?: LazyRouteDefinition<RouteObject>;
}
type RouteObject = IndexRouteObject | NonIndexRouteObject;
type DataRouteObject = RouteObject & {
    children?: DataRouteObject[];
    id: string;
};
interface RouteMatch<ParamKey extends string = string, RouteObjectType extends RouteObject = RouteObject> extends AgnosticRouteMatch<ParamKey, RouteObjectType> {
}
interface DataRouteMatch extends RouteMatch<string, DataRouteObject> {
}
type PatchRoutesOnNavigationFunctionArgs = AgnosticPatchRoutesOnNavigationFunctionArgs<RouteObject, RouteMatch>;
type PatchRoutesOnNavigationFunction = AgnosticPatchRoutesOnNavigationFunction<RouteObject, RouteMatch>;
interface DataRouterContextObject extends Omit<NavigationContextObject, "future"> {
    router: Router$1;
    staticContext?: StaticHandlerContext;
    unstable_onError?: unstable_ClientOnErrorFunction;
}
declare const DataRouterContext: React.Context<DataRouterContextObject | null>;
declare const DataRouterStateContext: React.Context<RouterState | null>;
type ViewTransitionContextObject = {
    isTransitioning: false;
} | {
    isTransitioning: true;
    flushSync: boolean;
    currentLocation: Location;
    nextLocation: Location;
};
declare const ViewTransitionContext: React.Context<ViewTransitionContextObject>;
type FetchersContextObject = Map<string, any>;
declare const FetchersContext: React.Context<FetchersContextObject>;
declare const AwaitContext: React.Context<TrackedPromise | null>;
declare const AwaitContextProvider: (props: React.ComponentProps<typeof AwaitContext.Provider>) => React.FunctionComponentElement<React.ProviderProps<TrackedPromise | null>>;
interface NavigateOptions {
    /** Replace the current entry in the history stack instead of pushing a new one */
    replace?: boolean;
    /** Adds persistent client side routing state to the next location */
    state?: any;
    /** If you are using {@link https://api.reactrouter.com/v7/functions/react_router.ScrollRestoration.html <ScrollRestoration>}, prevent the scroll position from being reset to the top of the window when navigating */
    preventScrollReset?: boolean;
    /** Defines the relative path behavior for the link. "route" will use the route hierarchy so ".." will remove all URL segments of the current route pattern while "path" will use the URL path so ".." will remove one URL segment. */
    relative?: RelativeRoutingType;
    /** Wraps the initial state update for this navigation in a {@link https://react.dev/reference/react-dom/flushSync ReactDOM.flushSync} call instead of the default {@link https://react.dev/reference/react/startTransition React.startTransition} */
    flushSync?: boolean;
    /** Enables a {@link https://developer.mozilla.org/en-US/docs/Web/API/View_Transitions_API View Transition} for this navigation by wrapping the final state update in `document.startViewTransition()`. If you need to apply specific styles for this view transition, you will also need to leverage the {@link https://api.reactrouter.com/v7/functions/react_router.useViewTransitionState.html useViewTransitionState()} hook.  */
    viewTransition?: boolean;
}
/**
 * A Navigator is a "location changer"; it's how you get to different locations.
 *
 * Every history instance conforms to the Navigator interface, but the
 * distinction is useful primarily when it comes to the low-level `<Router>` API
 * where both the location and a navigator must be provided separately in order
 * to avoid "tearing" that may occur in a suspense-enabled app if the action
 * and/or location were to be read directly from the history instance.
 */
interface Navigator {
    createHref: History["createHref"];
    encodeLocation?: History["encodeLocation"];
    go: History["go"];
    push(to: To, state?: any, opts?: NavigateOptions): void;
    replace(to: To, state?: any, opts?: NavigateOptions): void;
}
interface NavigationContextObject {
    basename: string;
    navigator: Navigator;
    static: boolean;
    future: {};
}
declare const NavigationContext: React.Context<NavigationContextObject>;
interface LocationContextObject {
    location: Location;
    navigationType: Action;
}
declare const LocationContext: React.Context<LocationContextObject>;
interface RouteContextObject {
    outlet: React.ReactElement | null;
    matches: RouteMatch[];
    isDataRoute: boolean;
}
declare const RouteContext: React.Context<RouteContextObject>;

export { type DataStrategyMatch as $, type ActionFunctionArgs as A, type BlockerFunction as B, type PatchRoutesOnNavigationFunction as C, type DataStrategyResult as D, type ErrorBoundaryType as E, type DataRouteObject as F, type StaticHandler as G, type HydrationState as H, type InitialEntry as I, type GetScrollPositionFunction as J, type GetScrollRestorationKeyFunction as K, type Location as L, type MiddlewareNextFunction as M, type NavigateOptions as N, type StaticHandlerContext as O, type Params as P, type Fetcher as Q, type RouterProviderProps as R, type ShouldRevalidateFunction as S, type To as T, type UIMatch as U, type NavigationStates as V, type RouterSubscriber as W, type RouterNavigateOptions as X, type RouterFetchOptions as Y, type RevalidationState as Z, type DataStrategyFunctionArgs as _, type RouterInit as a, hydrationRouteProperties as a$, type ErrorResponse as a0, type FormEncType as a1, type FormMethod as a2, type HTMLFormMethod as a3, type LazyRouteFunction as a4, type PathParam as a5, type RedirectFunction as a6, type RouterContext as a7, type ShouldRevalidateFunctionArgs as a8, createContext as a9, type RouteProps as aA, type RouterProps as aB, type RoutesProps as aC, Await as aD, MemoryRouter as aE, Navigate as aF, Outlet as aG, Route as aH, Router as aI, RouterProvider as aJ, Routes as aK, createMemoryRouter as aL, createRoutesFromChildren as aM, createRoutesFromElements as aN, renderMatches as aO, type Future as aP, createBrowserHistory as aQ, invariant as aR, createRouter as aS, ErrorResponseImpl as aT, DataRouterContext as aU, DataRouterStateContext as aV, FetchersContext as aW, LocationContext as aX, NavigationContext as aY, RouteContext as aZ, ViewTransitionContext as a_, createPath as aa, parsePath as ab, IDLE_NAVIGATION as ac, IDLE_FETCHER as ad, IDLE_BLOCKER as ae, data as af, generatePath as ag, isRouteErrorResponse as ah, matchPath as ai, matchRoutes as aj, redirect as ak, redirectDocument as al, replace as am, resolvePath as an, type Navigator as ao, type PatchRoutesOnNavigationFunctionArgs as ap, type RouteMatch as aq, AwaitContextProvider as ar, type AwaitProps as as, type IndexRouteProps as at, type LayoutRouteProps as au, type MemoryRouterOpts as av, type MemoryRouterProps as aw, type NavigateProps as ax, type OutletProps as ay, type PathRouteProps as az, type LoaderFunctionArgs as b, mapRouteProperties as b0, WithComponentProps as b1, withComponentProps as b2, WithHydrateFallbackProps as b3, withHydrateFallbackProps as b4, WithErrorBoundaryProps as b5, withErrorBoundaryProps as b6, type RouteManifest as b7, type History as b8, type FutureConfig as b9, type CreateStaticHandlerOptions as ba, type ActionFunction as c, type LoaderFunction as d, type DataRouteMatch as e, type MiddlewareFunction as f, RouterContextProvider as g, DataWithResponseInit as h, type MiddlewareEnabled as i, type Router$1 as j, type DataStrategyFunction as k, type Blocker as l, type RelativeRoutingType as m, type ParamParseKey as n, type Path as o, type PathPattern as p, type PathMatch as q, type Navigation as r, Action as s, type RouteObject as t, type unstable_ClientOnErrorFunction as u, type IndexRouteObject as v, type RouteComponentType as w, type HydrateFallbackType as x, type NonIndexRouteObject as y, type RouterState as z };
