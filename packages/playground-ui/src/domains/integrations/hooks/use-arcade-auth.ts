/**
 * Hook for Arcade tool authorization
 *
 * Provides functionality to authorize Arcade tools that require OAuth
 * (e.g., Google, GitHub, etc.)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

export interface ArcadeAuthState {
  status: 'idle' | 'pending' | 'completed' | 'failed';
  authorizationId?: string;
  authorizationUrl?: string;
  error?: string;
}

export interface UseArcadeAuthOptions {
  /** Callback when authorization completes successfully */
  onSuccess?: () => void;
  /** Callback when authorization fails */
  onError?: (error: string) => void;
  /** User ID for the authorization context (defaults to 'default-user') */
  userId?: string;
}

export interface UseArcadeAuthReturn {
  /** Current authorization state */
  authState: ArcadeAuthState;
  /** Start authorization for a toolkit */
  authorize: (toolkitSlug: string) => Promise<void>;
  /** Check authorization status */
  checkStatus: (authorizationId: string) => Promise<boolean>;
  /** Reset authorization state */
  reset: () => void;
  /** Whether authorization is in progress */
  isAuthorizing: boolean;
}

/**
 * Hook for managing Arcade tool authorization
 *
 * @example
 * ```tsx
 * const { authState, authorize, isAuthorizing } = useArcadeAuth({
 *   onSuccess: () => console.log('Authorized!'),
 *   userId: 'user@example.com'
 * });
 *
 * // Start authorization for a toolkit
 * await authorize('Google');
 *
 * // If authState.authorizationUrl is set, show it to the user
 * ```
 */
export function useArcadeAuth(options: UseArcadeAuthOptions = {}): UseArcadeAuthReturn {
  const { onSuccess, onError, userId = 'default-user' } = options;
  const client = useMastraClient();
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<Window | null>(null);

  const [authState, setAuthState] = useState<ArcadeAuthState>({
    status: 'idle',
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
    };
  }, []);

  // Authorize mutation
  const authorizeMutation = useMutation({
    mutationFn: async (toolkitSlug: string) => {
      const response = await fetch('/api/integrations/arcade/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkitSlug, userId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Authorization failed' }));
        throw new Error(error.message || 'Authorization failed');
      }

      return response.json() as Promise<{
        status: 'pending' | 'completed';
        authorizationId?: string;
        authorizationUrl?: string;
        scopes?: string[];
      }>;
    },
  });

  // Status check mutation
  const statusMutation = useMutation({
    mutationFn: async (authorizationId: string) => {
      const response = await fetch(`/api/integrations/arcade/auth/status?authorizationId=${authorizationId}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Status check failed' }));
        throw new Error(error.message || 'Status check failed');
      }

      return response.json() as Promise<{
        status: 'pending' | 'completed' | 'failed';
        completed: boolean;
      }>;
    },
  });

  // Poll for authorization completion
  const startPolling = useCallback((authorizationId: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }

    pollingRef.current = setInterval(async () => {
      try {
        const result = await statusMutation.mutateAsync(authorizationId);

        if (result.completed) {
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          // Close popup if open
          if (popupRef.current && !popupRef.current.closed) {
            popupRef.current.close();
          }

          setAuthState({
            status: 'completed',
            authorizationId,
          });

          onSuccess?.();
        } else if (result.status === 'failed') {
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }

          setAuthState({
            status: 'failed',
            authorizationId,
            error: 'Authorization was denied or failed',
          });

          onError?.('Authorization was denied or failed');
        }
      } catch (error) {
        // Continue polling on transient errors
        console.error('Error checking auth status:', error);
      }
    }, 2000); // Poll every 2 seconds
  }, [statusMutation, onSuccess, onError]);

  // Main authorize function
  const authorize = useCallback(async (toolkitSlug: string) => {
    setAuthState({
      status: 'pending',
    });

    try {
      const result = await authorizeMutation.mutateAsync(toolkitSlug);

      if (result.status === 'completed') {
        // Already authorized
        setAuthState({
          status: 'completed',
          authorizationId: result.authorizationId,
        });
        onSuccess?.();
        return;
      }

      // Need user to authorize
      setAuthState({
        status: 'pending',
        authorizationId: result.authorizationId,
        authorizationUrl: result.authorizationUrl,
      });

      // Open popup for authorization
      if (result.authorizationUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        popupRef.current = window.open(
          result.authorizationUrl,
          'arcade_auth_popup',
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Start polling for completion
        if (result.authorizationId) {
          startPolling(result.authorizationId);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Authorization failed';
      setAuthState({
        status: 'failed',
        error: errorMsg,
      });
      onError?.(errorMsg);
    }
  }, [authorizeMutation, onSuccess, onError, startPolling]);

  // Check status function
  const checkStatus = useCallback(async (authorizationId: string): Promise<boolean> => {
    try {
      const result = await statusMutation.mutateAsync(authorizationId);
      return result.completed;
    } catch {
      return false;
    }
  }, [statusMutation]);

  // Reset function
  const reset = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (popupRef.current && !popupRef.current.closed) {
      popupRef.current.close();
    }
    setAuthState({ status: 'idle' });
  }, []);

  return {
    authState,
    authorize,
    checkStatus,
    reset,
    isAuthorizing: authState.status === 'pending',
  };
}

/**
 * Get a unique tool name for authorization from a toolkit
 *
 * Arcade tools have fully qualified names like "Google.ListEmails"
 * For toolkit-level auth, we use the first tool in the toolkit
 */
export function getToolNameForAuth(toolkit: { slug: string; metadata?: Record<string, unknown> }): string | null {
  // The toolkit slug is usually the auth provider name (e.g., "Google", "Github")
  // We need to construct a valid tool name for authorization
  // This could be any tool from that toolkit - we'll use a common pattern
  const authProvider = toolkit.metadata?.authProvider as string | undefined;

  if (!authProvider) {
    return null;
  }

  // Use the toolkit slug as the tool namespace
  // Arcade will authorize all tools from that provider
  return `${toolkit.slug}.Authorization`;
}
