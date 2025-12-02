import React from "react";
import { ReactNode } from "react";
import { AuthTokenFetcher } from "../browser/sync/client.js";
type IConvexReactClient = {
    setAuth(fetchToken: AuthTokenFetcher): void;
    clearAuth(): void;
};
type UseAuth = () => {
    isLoaded: boolean;
    isSignedIn: boolean | undefined;
    getToken: (options: {
        template?: "convex";
        skipCache?: boolean;
    }) => Promise<string | null>;
    orgId: string | undefined | null;
    orgRole: string | undefined | null;
};
/**
 * A wrapper React component which provides a {@link react.ConvexReactClient}
 * authenticated with Clerk.
 *
 * It must be wrapped by a configured `ClerkProvider`, from
 * `@clerk/clerk-react`, `@clerk/clerk-expo`, `@clerk/nextjs` or
 * another React-based Clerk client library and have the corresponding
 * `useAuth` hook passed in.
 *
 * See [Convex Clerk](https://docs.convex.dev/auth/clerk) on how to set up
 * Convex with Clerk.
 *
 * @public
 */
export declare function ConvexProviderWithClerk({ children, client, useAuth, }: {
    children: ReactNode;
    client: IConvexReactClient;
    useAuth: UseAuth;
}): React.JSX.Element;
export {};
//# sourceMappingURL=ConvexProviderWithClerk.d.ts.map