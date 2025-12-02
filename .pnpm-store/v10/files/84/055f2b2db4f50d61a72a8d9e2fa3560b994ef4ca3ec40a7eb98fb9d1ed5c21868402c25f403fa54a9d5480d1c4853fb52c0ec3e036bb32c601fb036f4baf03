interface RouterContext<T = unknown> {
    root: Node<T>;
    static: Record<string, Node<T> | undefined>;
}
type ParamsIndexMap = Array<[
    Index: number,
    name: string | RegExp,
    optional: boolean
]>;
type MethodData<T = unknown> = {
    data: T;
    paramsMap?: ParamsIndexMap;
};
interface Node<T = unknown> {
    key: string;
    static?: Record<string, Node<T>>;
    param?: Node<T>;
    wildcard?: Node<T>;
    methods?: Record<string, MethodData<T>[] | undefined>;
}
type MatchedRoute<T = unknown> = {
    data: T;
    params?: Record<string, string>;
};

/**
 * Create a new router context.
 */
declare function createRouter<T = unknown>(): RouterContext<T>;

/**
 * Add a route to the router context.
 */
declare function addRoute<T>(ctx: RouterContext<T>, method: string | undefined, path: string, data?: T): void;

/**
 * Find a route by path.
 */
declare function findRoute<T = unknown>(ctx: RouterContext<T>, method: string | undefined, path: string, opts?: {
    params?: boolean;
}): MatchedRoute<T> | undefined;

/**
 * Remove a route from the router context.
 */
declare function removeRoute<T>(ctx: RouterContext<T>, method: string, path: string): void;

/**
 * Find all route patterns that match the given path.
 */
declare function findAllRoutes<T>(ctx: RouterContext<T>, method: string | undefined, path: string, opts?: {
    params?: boolean;
}): MatchedRoute<T>[];

export { type RouterContext, addRoute, createRouter, findAllRoutes, findRoute, removeRoute };
