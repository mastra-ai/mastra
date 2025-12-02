import { RoutingMode, ClerkHostRouter } from '@clerk/types';
export { ClerkHostRouter, RoutingMode } from '@clerk/types';
import React from 'react';

/**
 * Internal Clerk router, used by Clerk components to interact with the host's router.
 */
type ClerkRouter = {
    makeDestinationUrlWithPreservedQueryParameters: (path: string) => string;
    /**
     * The basePath the router is currently mounted on.
     */
    basePath: string;
    /**
     * Creates a child router instance scoped to the provided base path.
     */
    child: (childBasePath: string) => ClerkRouter;
    /**
     * Matches the provided path against the router's current path. If index is provided, matches against the root route of the router.
     */
    match: (path?: string, index?: boolean) => boolean;
    /**
     * Mode of the router instance, path-based or virtual
     */
    readonly mode: RoutingMode;
    /**
     * Name of the router instance
     */
    readonly name: string;
    /**
     * Navigates to the provided path via a history push
     */
    push: ClerkHostRouter['push'];
    /**
     * Navigates to the provided path via a history replace
     */
    replace: ClerkHostRouter['replace'];
    /**
     * If supported by the host router, navigates to the provided path without triggering a full navigation
     */
    shallowPush: ClerkHostRouter['shallowPush'];
    /**
     * Returns the current pathname (including the base path)
     */
    pathname: ClerkHostRouter['pathname'];
    /**
     * Returns the current search params
     */
    searchParams: ClerkHostRouter['searchParams'];
};
/**
 * Factory function to create an instance of ClerkRouter with the provided host router.
 *
 * @param router host router instance to be used by the router
 * @param basePath base path of the router, navigation and matching will be scoped to this path
 * @returns A ClerkRouter instance
 */
declare function createClerkRouter(router: ClerkHostRouter, basePath?: string): ClerkRouter;

/**
 * React-specific binding's for interacting with Clerk's router interface.
 */

declare const ClerkHostRouterContext: React.Context<ClerkHostRouter | null>;
declare const ClerkRouterContext: React.Context<ClerkRouter | null>;
declare function useClerkHostRouter(): ClerkHostRouter;
declare function useClerkRouter(): ClerkRouter;
/**
 * Construct a Clerk Router using the provided host router. The router instance is accessible using `useClerkRouter()`.
 */
declare function Router({ basePath, children, router, }: {
    children: React.ReactNode;
    basePath?: string;
    router?: ClerkHostRouter;
}): React.JSX.Element;
type RouteProps = {
    path?: string;
    index?: boolean;
};
/**
 * Used to conditionally render its children based on whether or not the current path matches the provided path.
 */
declare function Route({ path, children, index }: RouteProps & {
    children: React.ReactNode;
}): React.ReactNode;

export { ClerkHostRouterContext, type ClerkRouter, ClerkRouterContext, Route, Router, createClerkRouter, useClerkHostRouter, useClerkRouter };
