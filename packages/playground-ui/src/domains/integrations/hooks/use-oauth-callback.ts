/**
 * Hook to detect and handle OAuth callback completion.
 *
 * When the user returns from Smithery OAuth, the callback page stores
 * the authorization code and redirects here with ?oauth=complete.
 * This hook detects that and provides the code for completing the flow.
 */

import { useEffect, useState } from 'react';
import {
  consumeOAuthCode,
  getPendingOAuthServer,
  getPendingOAuthState,
  clearPendingOAuthServer,
  type PendingOAuthState,
} from '../lib/smithery-oauth-provider';

export interface OAuthCallbackState {
  /** Whether we're returning from an OAuth redirect */
  isReturningFromOAuth: boolean;
  /** The authorization code from the OAuth callback */
  authorizationCode: string | null;
  /** The server URL we were authenticating for */
  serverUrl: string | null;
  /** The full pending OAuth state including server details */
  pendingState: PendingOAuthState | null;
  /** Clear the OAuth state after handling */
  clearOAuthState: () => void;
}

/**
 * Detects when returning from OAuth callback and provides the authorization code.
 *
 * @example
 * ```tsx
 * const { isReturningFromOAuth, authorizationCode, pendingState, clearOAuthState } = useOAuthCallback();
 *
 * useEffect(() => {
 *   if (isReturningFromOAuth && authorizationCode && pendingState) {
 *     // Complete the OAuth flow with the code
 *     completeAuth(pendingState.serverUrl, authorizationCode).then(() => {
 *       clearOAuthState();
 *     });
 *   }
 * }, [isReturningFromOAuth, authorizationCode]);
 * ```
 */
export function useOAuthCallback(): OAuthCallbackState {
  const [state, setState] = useState<{
    isReturningFromOAuth: boolean;
    authorizationCode: string | null;
    serverUrl: string | null;
    pendingState: PendingOAuthState | null;
  }>({
    isReturningFromOAuth: false,
    authorizationCode: null,
    serverUrl: null,
    pendingState: null,
  });

  useEffect(() => {
    // Check if we're returning from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthComplete = urlParams.get('oauth') === 'complete';

    if (isOAuthComplete) {
      // Get the stored authorization code and server state
      const code = consumeOAuthCode();
      const serverUrl = getPendingOAuthServer();
      const pendingState = getPendingOAuthState();

      setState({
        isReturningFromOAuth: true,
        authorizationCode: code,
        serverUrl,
        pendingState,
      });

      // Clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('oauth');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  const clearOAuthState = () => {
    clearPendingOAuthServer();
    setState({
      isReturningFromOAuth: false,
      authorizationCode: null,
      serverUrl: null,
      pendingState: null,
    });
  };

  return {
    ...state,
    clearOAuthState,
  };
}
