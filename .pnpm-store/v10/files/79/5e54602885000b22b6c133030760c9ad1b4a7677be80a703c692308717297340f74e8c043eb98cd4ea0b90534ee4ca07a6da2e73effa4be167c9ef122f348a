import React from "react";
import { ReactNode } from "react";
import { useConvexAuth } from "./ConvexAuthState.js";

/**
 * Renders children if the client is authenticated.
 *
 * @public
 */
export function Authenticated({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading || !isAuthenticated) {
    return null;
  }
  return <>{children}</>;
}

/**
 * Renders children if the client is using authentication but is not authenticated.
 *
 * @public
 */
export function Unauthenticated({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  if (isLoading || isAuthenticated) {
    return null;
  }
  return <>{children}</>;
}

/**
 * Renders children if the client isn't using authentication or is in the process
 * of authenticating.
 *
 * @public
 */
export function AuthLoading({ children }: { children: ReactNode }) {
  const { isLoading } = useConvexAuth();
  if (!isLoading) {
    return null;
  }
  return <>{children}</>;
}
