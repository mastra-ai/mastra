import { ComponentType, ReactElement } from 'react';
import { A as ActionFunctionArgs, b as LoaderFunctionArgs, c as ActionFunction, d as LoaderFunction, P as Params, L as Location, e as DataRouteMatch, f as MiddlewareFunction, D as DataStrategyResult, S as ShouldRevalidateFunction, g as RouterContextProvider, h as DataWithResponseInit, i as MiddlewareEnabled } from './context-DSyS5mLj.mjs';

/**
 * An object of unknown type for route loaders and actions provided by the
 * server's `getLoadContext()` function.  This is defined as an empty interface
 * specifically so apps can leverage declaration merging to augment this type
 * globally: https://www.typescriptlang.org/docs/handbook/declaration-merging.html
 */
interface AppLoadContext {
    [key: string]: unknown;
}

type Primitive = null | undefined | string | number | boolean | symbol | bigint;
type LiteralUnion<LiteralType, BaseType extends Primitive> = LiteralType | (BaseType & Record<never, never>);
interface HtmlLinkProps {
    /**
     * Address of the hyperlink
     */
    href?: string;
    /**
     * How the element handles crossorigin requests
     */
    crossOrigin?: "anonymous" | "use-credentials";
    /**
     * Relationship between the document containing the hyperlink and the destination resource
     */
    rel: LiteralUnion<"alternate" | "dns-prefetch" | "icon" | "manifest" | "modulepreload" | "next" | "pingback" | "preconnect" | "prefetch" | "preload" | "prerender" | "search" | "stylesheet", string>;
    /**
     * Applicable media: "screen", "print", "(max-width: 764px)"
     */
    media?: string;
    /**
     * Integrity metadata used in Subresource Integrity checks
     */
    integrity?: string;
    /**
     * Language of the linked resource
     */
    hrefLang?: string;
    /**
     * Hint for the type of the referenced resource
     */
    type?: string;
    /**
     * Referrer policy for fetches initiated by the element
     */
    referrerPolicy?: "" | "no-referrer" | "no-referrer-when-downgrade" | "same-origin" | "origin" | "strict-origin" | "origin-when-cross-origin" | "strict-origin-when-cross-origin" | "unsafe-url";
    /**
     * Sizes of the icons (for rel="icon")
     */
    sizes?: string;
    /**
     * Potential destination for a preload request (for rel="preload" and rel="modulepreload")
     */
    as?: LiteralUnion<"audio" | "audioworklet" | "document" | "embed" | "fetch" | "font" | "frame" | "iframe" | "image" | "manifest" | "object" | "paintworklet" | "report" | "script" | "serviceworker" | "sharedworker" | "style" | "track" | "video" | "worker" | "xslt", string>;
    /**
     * Color to use when customizing a site's icon (for rel="mask-icon")
     */
    color?: string;
    /**
     * Whether the link is disabled
     */
    disabled?: boolean;
    /**
     * The title attribute has special semantics on this element: Title of the link; CSS style sheet set name.
     */
    title?: string;
    /**
     * Images to use in different situations, e.g., high-resolution displays,
     * small monitors, etc. (for rel="preload")
     */
    imageSrcSet?: string;
    /**
     * Image sizes for different page layouts (for rel="preload")
     */
    imageSizes?: string;
}
interface HtmlLinkPreloadImage extends HtmlLinkProps {
    /**
     * Relationship between the document containing the hyperlink and the destination resource
     */
    rel: "preload";
    /**
     * Potential destination for a preload request (for rel="preload" and rel="modulepreload")
     */
    as: "image";
    /**
     * Address of the hyperlink
     */
    href?: string;
    /**
     * Images to use in different situations, e.g., high-resolution displays,
     * small monitors, etc. (for rel="preload")
     */
    imageSrcSet: string;
    /**
     * Image sizes for different page layouts (for rel="preload")
     */
    imageSizes?: string;
}
/**
 * Represents a `<link>` element.
 *
 * WHATWG Specification: https://html.spec.whatwg.org/multipage/semantics.html#the-link-element
 */
type HtmlLinkDescriptor = (HtmlLinkProps & Pick<Required<HtmlLinkProps>, "href">) | (HtmlLinkPreloadImage & Pick<Required<HtmlLinkPreloadImage>, "imageSizes">) | (HtmlLinkPreloadImage & Pick<Required<HtmlLinkPreloadImage>, "href"> & {
    imageSizes?: never;
});
interface PageLinkDescriptor extends Omit<HtmlLinkDescriptor, "href" | "rel" | "type" | "sizes" | "imageSrcSet" | "imageSizes" | "as" | "color" | "title"> {
    /**
     * A [`nonce`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/nonce)
     * attribute to render on the [`<link>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/link)
     * element
     */
    nonce?: string | undefined;
    /**
     * The absolute path of the page to prefetch, e.g. `/absolute/path`.
     */
    page: string;
}
type LinkDescriptor = HtmlLinkDescriptor | PageLinkDescriptor;

interface RouteModules {
    [routeId: string]: RouteModule$1 | undefined;
}
/**
 * The shape of a route module shipped to the client
 */
interface RouteModule$1 {
    clientAction?: ClientActionFunction;
    clientLoader?: ClientLoaderFunction;
    clientMiddleware?: MiddlewareFunction<Record<string, DataStrategyResult>>[];
    ErrorBoundary?: ErrorBoundaryComponent;
    HydrateFallback?: HydrateFallbackComponent;
    Layout?: LayoutComponent;
    default: RouteComponent;
    handle?: RouteHandle;
    links?: LinksFunction;
    meta?: MetaFunction;
    shouldRevalidate?: ShouldRevalidateFunction;
}
/**
 * The shape of a route module on the server
 */
interface ServerRouteModule extends RouteModule$1 {
    action?: ActionFunction;
    headers?: HeadersFunction | {
        [name: string]: string;
    };
    loader?: LoaderFunction;
    middleware?: MiddlewareFunction<Response>[];
}
/**
 * A function that handles data mutations for a route on the client
 */
type ClientActionFunction = (args: ClientActionFunctionArgs) => ReturnType<ActionFunction>;
/**
 * Arguments passed to a route `clientAction` function
 */
type ClientActionFunctionArgs = ActionFunctionArgs & {
    serverAction: <T = unknown>() => Promise<SerializeFrom<T>>;
};
/**
 * A function that loads data for a route on the client
 */
type ClientLoaderFunction = ((args: ClientLoaderFunctionArgs) => ReturnType<LoaderFunction>) & {
    hydrate?: boolean;
};
/**
 * Arguments passed to a route `clientLoader` function
 */
type ClientLoaderFunctionArgs = LoaderFunctionArgs & {
    serverLoader: <T = unknown>() => Promise<SerializeFrom<T>>;
};
/**
 * ErrorBoundary to display for this route
 */
type ErrorBoundaryComponent = ComponentType;
type HeadersArgs = {
    loaderHeaders: Headers;
    parentHeaders: Headers;
    actionHeaders: Headers;
    errorHeaders: Headers | undefined;
};
/**
 * A function that returns HTTP headers to be used for a route. These headers
 * will be merged with (and take precedence over) headers from parent routes.
 */
interface HeadersFunction {
    (args: HeadersArgs): Headers | HeadersInit;
}
/**
 * `<Route HydrateFallback>` component to render on initial loads
 * when client loaders are present
 */
type HydrateFallbackComponent = ComponentType;
/**
 * Optional, root-only `<Route Layout>` component to wrap the root content in.
 * Useful for defining the <html>/<head>/<body> document shell shared by the
 * Component, HydrateFallback, and ErrorBoundary
 */
type LayoutComponent = ComponentType<{
    children: ReactElement<unknown, ErrorBoundaryComponent | HydrateFallbackComponent | RouteComponent>;
}>;
/**
 * A function that defines `<link>` tags to be inserted into the `<head>` of
 * the document on route transitions.
 *
 * @see https://remix.run/route/meta
 */
interface LinksFunction {
    (): LinkDescriptor[];
}
interface MetaMatch<RouteId extends string = string, Loader extends LoaderFunction | ClientLoaderFunction | unknown = unknown> {
    id: RouteId;
    pathname: DataRouteMatch["pathname"];
    /** @deprecated Use `MetaMatch.loaderData` instead */
    data: Loader extends LoaderFunction | ClientLoaderFunction ? SerializeFrom<Loader> : unknown;
    loaderData: Loader extends LoaderFunction | ClientLoaderFunction ? SerializeFrom<Loader> : unknown;
    handle?: RouteHandle;
    params: DataRouteMatch["params"];
    meta: MetaDescriptor[];
    error?: unknown;
}
type MetaMatches<MatchLoaders extends Record<string, LoaderFunction | ClientLoaderFunction | unknown> = Record<string, unknown>> = Array<{
    [K in keyof MatchLoaders]: MetaMatch<Exclude<K, number | symbol>, MatchLoaders[K]>;
}[keyof MatchLoaders]>;
interface MetaArgs<Loader extends LoaderFunction | ClientLoaderFunction | unknown = unknown, MatchLoaders extends Record<string, LoaderFunction | ClientLoaderFunction | unknown> = Record<string, unknown>> {
    /** @deprecated Use `MetaArgs.loaderData` instead */
    data: (Loader extends LoaderFunction | ClientLoaderFunction ? SerializeFrom<Loader> : unknown) | undefined;
    loaderData: (Loader extends LoaderFunction | ClientLoaderFunction ? SerializeFrom<Loader> : unknown) | undefined;
    params: Params;
    location: Location;
    matches: MetaMatches<MatchLoaders>;
    error?: unknown;
}
/**
 * A function that returns an array of data objects to use for rendering
 * metadata HTML tags in a route. These tags are not rendered on descendant
 * routes in the route hierarchy. In other words, they will only be rendered on
 * the route in which they are exported.
 *
 * @param Loader - The type of the current route's loader function
 * @param MatchLoaders - Mapping from a parent route's filepath to its loader
 * function type
 *
 * Note that parent route filepaths are relative to the `app/` directory.
 *
 * For example, if this meta function is for `/sales/customers/$customerId`:
 *
 * ```ts
 * // app/root.tsx
 * const loader = () => ({ hello: "world" })
 * export type Loader = typeof loader
 *
 * // app/routes/sales.tsx
 * const loader = () => ({ salesCount: 1074 })
 * export type Loader = typeof loader
 *
 * // app/routes/sales/customers.tsx
 * const loader = () => ({ customerCount: 74 })
 * export type Loader = typeof loader
 *
 * // app/routes/sales/customers/$customersId.tsx
 * import type { Loader as RootLoader } from "../../../root"
 * import type { Loader as SalesLoader } from "../../sales"
 * import type { Loader as CustomersLoader } from "../../sales/customers"
 *
 * const loader = () => ({ name: "Customer name" })
 *
 * const meta: MetaFunction<typeof loader, {
 *  "root": RootLoader,
 *  "routes/sales": SalesLoader,
 *  "routes/sales/customers": CustomersLoader,
 * }> = ({ data, matches }) => {
 *   const { name } = data
 *   //      ^? string
 *   const { customerCount } = matches.find((match) => match.id === "routes/sales/customers").data
 *   //      ^? number
 *   const { salesCount } = matches.find((match) => match.id === "routes/sales").data
 *   //      ^? number
 *   const { hello } = matches.find((match) => match.id === "root").data
 *   //      ^? "world"
 * }
 * ```
 */
interface MetaFunction<Loader extends LoaderFunction | ClientLoaderFunction | unknown = unknown, MatchLoaders extends Record<string, LoaderFunction | ClientLoaderFunction | unknown> = Record<string, unknown>> {
    (args: MetaArgs<Loader, MatchLoaders>): MetaDescriptor[] | undefined;
}
type MetaDescriptor = {
    charSet: "utf-8";
} | {
    title: string;
} | {
    name: string;
    content: string;
} | {
    property: string;
    content: string;
} | {
    httpEquiv: string;
    content: string;
} | {
    "script:ld+json": LdJsonObject;
} | {
    tagName: "meta" | "link";
    [name: string]: string;
} | {
    [name: string]: unknown;
};
type LdJsonObject = {
    [Key in string]: LdJsonValue;
} & {
    [Key in string]?: LdJsonValue | undefined;
};
type LdJsonArray = LdJsonValue[] | readonly LdJsonValue[];
type LdJsonPrimitive = string | number | boolean | null;
type LdJsonValue = LdJsonPrimitive | LdJsonObject | LdJsonArray;
/**
 * A React component that is rendered for a route.
 */
type RouteComponent = ComponentType<{}>;
/**
 * An arbitrary object that is associated with a route.
 *
 * @see https://remix.run/route/handle
 */
type RouteHandle = unknown;

type Serializable = undefined | null | boolean | string | symbol | number | Array<Serializable> | {
    [key: PropertyKey]: Serializable;
} | bigint | Date | URL | RegExp | Error | Map<Serializable, Serializable> | Set<Serializable> | Promise<Serializable>;

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Func = (...args: any[]) => unknown;
type Pretty<T> = {
    [K in keyof T]: T[K];
} & {};
type Normalize<T> = _Normalize<UnionKeys<T>, T>;
type _Normalize<Key extends keyof any, T> = T extends infer U ? Pretty<{
    [K in Key as K extends keyof U ? undefined extends U[K] ? never : K : never]: K extends keyof U ? U[K] : never;
} & {
    [K in Key as K extends keyof U ? undefined extends U[K] ? K : never : never]?: K extends keyof U ? U[K] : never;
} & {
    [K in Key as K extends keyof U ? never : K]?: undefined;
}> : never;
type UnionKeys<T> = T extends any ? keyof T : never;

type RouteModule = {
    meta?: Func;
    links?: Func;
    headers?: Func;
    loader?: Func;
    clientLoader?: Func;
    action?: Func;
    clientAction?: Func;
    HydrateFallback?: Func;
    default?: Func;
    ErrorBoundary?: Func;
    [key: string]: unknown;
};

/**
 * A brand that can be applied to a type to indicate that it will serialize
 * to a specific type when transported to the client from a loader.
 * Only use this if you have additional serialization/deserialization logic
 * in your application.
 */
type unstable_SerializesTo<T> = {
    unstable__ReactRouter_SerializesTo: [T];
};

type Serialize<T> = T extends unstable_SerializesTo<infer To> ? To : T extends Serializable ? T : T extends (...args: any[]) => unknown ? undefined : T extends Promise<infer U> ? Promise<Serialize<U>> : T extends Map<infer K, infer V> ? Map<Serialize<K>, Serialize<V>> : T extends ReadonlyMap<infer K, infer V> ? ReadonlyMap<Serialize<K>, Serialize<V>> : T extends Set<infer U> ? Set<Serialize<U>> : T extends ReadonlySet<infer U> ? ReadonlySet<Serialize<U>> : T extends [] ? [] : T extends readonly [infer F, ...infer R] ? [Serialize<F>, ...Serialize<R>] : T extends Array<infer U> ? Array<Serialize<U>> : T extends readonly unknown[] ? readonly Serialize<T[number]>[] : T extends Record<any, any> ? {
    [K in keyof T]: Serialize<T[K]>;
} : undefined;
type VoidToUndefined<T> = Equal<T, void> extends true ? undefined : T;
type DataFrom<T> = IsAny<T> extends true ? undefined : T extends Func ? VoidToUndefined<Awaited<ReturnType<T>>> : undefined;
type ClientData<T> = T extends Response ? never : T extends DataWithResponseInit<infer U> ? U : T;
type ServerData<T> = T extends Response ? never : T extends DataWithResponseInit<infer U> ? Serialize<U> : Serialize<T>;
type ServerDataFrom<T> = ServerData<DataFrom<T>>;
type ClientDataFrom<T> = ClientData<DataFrom<T>>;
type ClientDataFunctionArgs<Params> = {
    /**
     * A {@link https://developer.mozilla.org/en-US/docs/Web/API/Request Fetch Request instance} which you can use to read the URL, the method, the "content-type" header, and the request body from the request.
     *
     * @note Because client data functions are called before a network request is made, the Request object does not include the headers which the browser automatically adds. React Router infers the "content-type" header from the enc-type of the form that performed the submission.
     **/
    request: Request;
    /**
     * {@link https://reactrouter.com/start/framework/routing#dynamic-segments Dynamic route params} for the current route.
     * @example
     * // app/routes.ts
     * route("teams/:teamId", "./team.tsx"),
     *
     * // app/team.tsx
     * export function clientLoader({
     *   params,
     * }: Route.ClientLoaderArgs) {
     *   params.teamId;
     *   //        ^ string
     * }
     **/
    params: Params;
    /**
     * When `future.v8_middleware` is not enabled, this is undefined.
     *
     * When `future.v8_middleware` is enabled, this is an instance of
     * `RouterContextProvider` and can be used to access context values
     * from your route middlewares.  You may pass in initial context values in your
     * `<HydratedRouter getContext>` prop
     */
    context: Readonly<RouterContextProvider>;
};
type ServerDataFunctionArgs<Params> = {
    /** A {@link https://developer.mozilla.org/en-US/docs/Web/API/Request Fetch Request instance} which you can use to read the url, method, headers (such as cookies), and request body from the request. */
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
     **/
    params: Params;
    /**
     * Without `future.v8_middleware` enabled, this is the context passed in
     * to your server adapter's `getLoadContext` function. It's a way to bridge the
     * gap between the adapter's request/response API with your React Router app.
     * It is only applicable if you are using a custom server adapter.
     *
     * With `future.v8_middleware` enabled, this is an instance of
     * `RouterContextProvider` and can be used for type-safe access to
     * context value set in your route middlewares.  If you are using a custom
     * server adapter, you may provide an initial set of context values from your
     * `getLoadContext` function.
     */
    context: MiddlewareEnabled extends true ? Readonly<RouterContextProvider> : AppLoadContext;
};
type SerializeFrom<T> = T extends (...args: infer Args) => unknown ? Args extends [
    ClientLoaderFunctionArgs | ClientActionFunctionArgs | ClientDataFunctionArgs<unknown>
] ? ClientDataFrom<T> : ServerDataFrom<T> : T;
type IsDefined<T> = Equal<T, undefined> extends true ? false : true;
type IsHydrate<ClientLoader> = ClientLoader extends {
    hydrate: true;
} ? true : ClientLoader extends {
    hydrate: false;
} ? false : false;
type GetLoaderData<T extends RouteModule> = _DataLoaderData<ServerDataFrom<T["loader"]>, ClientDataFrom<T["clientLoader"]>, IsHydrate<T["clientLoader"]>, T extends {
    HydrateFallback: Func;
} ? true : false>;
type _DataLoaderData<ServerLoaderData, ClientLoaderData, ClientLoaderHydrate extends boolean, HasHydrateFallback> = [
    HasHydrateFallback,
    ClientLoaderHydrate
] extends [true, true] ? IsDefined<ClientLoaderData> extends true ? ClientLoaderData : undefined : [
    IsDefined<ClientLoaderData>,
    IsDefined<ServerLoaderData>
] extends [true, true] ? ServerLoaderData | ClientLoaderData : IsDefined<ClientLoaderData> extends true ? ClientLoaderData : IsDefined<ServerLoaderData> extends true ? ServerLoaderData : undefined;
type GetActionData<T extends RouteModule> = _DataActionData<ServerDataFrom<T["action"]>, ClientDataFrom<T["clientAction"]>>;
type _DataActionData<ServerActionData, ClientActionData> = Awaited<[
    IsDefined<ServerActionData>,
    IsDefined<ClientActionData>
] extends [true, true] ? ServerActionData | ClientActionData : IsDefined<ClientActionData> extends true ? ClientActionData : IsDefined<ServerActionData> extends true ? ServerActionData : undefined>;

export type { AppLoadContext as A, ClientDataFunctionArgs as C, Equal as E, Func as F, GetLoaderData as G, HeadersFunction as H, LinkDescriptor as L, MetaDescriptor as M, Normalize as N, Pretty as P, RouteModule as R, ServerDataFunctionArgs as S, ServerDataFrom as a, GetActionData as b, RouteModules as c, SerializeFrom as d, MetaFunction as e, LinksFunction as f, ClientActionFunction as g, ClientLoaderFunction as h, ClientActionFunctionArgs as i, ClientLoaderFunctionArgs as j, HeadersArgs as k, MetaArgs as l, PageLinkDescriptor as m, HtmlLinkDescriptor as n, ServerRouteModule as o, unstable_SerializesTo as u };
