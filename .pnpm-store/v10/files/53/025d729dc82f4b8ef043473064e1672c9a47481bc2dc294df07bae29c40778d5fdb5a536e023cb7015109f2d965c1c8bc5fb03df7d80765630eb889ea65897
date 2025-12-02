import * as React from 'react';
import { RouterProviderProps as RouterProviderProps$1, RouterInit, unstable_ClientOnErrorFunction } from 'react-router';

type RouterProviderProps = Omit<RouterProviderProps$1, "flushSync">;
declare function RouterProvider(props: Omit<RouterProviderProps, "flushSync">): React.JSX.Element;

/**
 * Props for the {@link dom.HydratedRouter} component.
 *
 * @category Types
 */
interface HydratedRouterProps {
    /**
     * Context object to be passed through to {@link createBrowserRouter} and made
     * available to
     * [`clientAction`](../../start/framework/route-module#clientAction)/[`clientLoader`](../../start/framework/route-module#clientLoader)
     * functions
     */
    getContext?: RouterInit["getContext"];
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
     * <HydratedRouter unstable_onError={(error, errorInfo) => {
     *   console.error(error, errorInfo);
     *   reportToErrorService(error, errorInfo);
     * }} />
     * ```
     */
    unstable_onError?: unstable_ClientOnErrorFunction;
}
/**
 * Framework-mode router component to be used to hydrate a router from a
 * {@link ServerRouter}. See [`entry.client.tsx`](../framework-conventions/entry.client.tsx).
 *
 * @public
 * @category Framework Routers
 * @mode framework
 * @param props Props
 * @param {dom.HydratedRouterProps.getContext} props.getContext n/a
 * @param {dom.HydratedRouterProps.unstable_onError} props.unstable_onError n/a
 * @returns A React element that represents the hydrated application.
 */
declare function HydratedRouter(props: HydratedRouterProps): React.JSX.Element;

export { HydratedRouter, type HydratedRouterProps, RouterProvider, type RouterProviderProps };
