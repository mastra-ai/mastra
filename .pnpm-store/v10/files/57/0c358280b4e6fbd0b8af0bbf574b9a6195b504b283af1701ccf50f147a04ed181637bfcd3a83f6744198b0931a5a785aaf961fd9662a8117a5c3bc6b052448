import React, { ReactNode } from "react";
import { AuthTokenFetcher } from "../browser/sync/client.js";
type IConvexReactClient = {
    setAuth(fetchToken: AuthTokenFetcher, onChange: (isAuthenticated: boolean) => void): void;
    clearAuth(): void;
};
/**
 * Type representing the state of an auth integration with Convex.
 *
 * @public
 */
export type ConvexAuthState = {
    isLoading: boolean;
    isAuthenticated: boolean;
};
/**
 * Get the {@link ConvexAuthState} within a React component.
 *
 * This relies on a Convex auth integration provider being above in the React
 * component tree.
 *
 * @returns The current {@link ConvexAuthState}.
 *
 * @public
 */
export declare function useConvexAuth(): {
    isLoading: boolean;
    isAuthenticated: boolean;
};
/**
 * A replacement for {@link ConvexProvider} which additionally provides
 * {@link ConvexAuthState} to descendants of this component.
 *
 * Use this to integrate any auth provider with Convex. The `useAuth` prop
 * should be a React hook that returns the provider's authentication state
 * and a function to fetch a JWT access token.
 *
 * If the `useAuth` prop function updates causing a rerender then auth state
 * will transition to loading and the `fetchAccessToken()` function called again.
 *
 * See [Custom Auth Integration](https://docs.convex.dev/auth/advanced/custom-auth) for more information.
 *
 * @public
 */
export declare function ConvexProviderWithAuth({ children, client, useAuth, }: {
    children?: ReactNode;
    client: IConvexReactClient;
    useAuth: () => {
        isLoading: boolean;
        isAuthenticated: boolean;
        fetchAccessToken: (args: {
            forceRefreshToken: boolean;
        }) => Promise<string | null>;
    };
}): React.JSX.Element;
export {};
//# sourceMappingURL=ConvexAuthState.d.ts.map