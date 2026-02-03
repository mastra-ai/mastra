/**
 * Hook for Composio tool authorization
 *
 * Provides functionality to authorize Composio tools that require OAuth
 * using Composio's managed authentication flow.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';

export interface ComposioAuthState {
  status: 'idle' | 'pending' | 'completed' | 'failed';
  authorizationId?: string;
  authorizationUrl?: string;
  error?: string;
}

export interface UseComposioAuthOptions {
  /** Callback when authorization completes successfully */
  onSuccess?: () => void;
  /** Callback when authorization fails */
  onError?: (error: string) => void;
  /** User ID for the authorization context (defaults to 'default-user') */
  userId?: string;
  /** Optional callback URL after authorization */
  callbackUrl?: string;
}

export interface UseComposioAuthReturn {
  /** Current authorization state */
  authState: ComposioAuthState;
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
 * Hook for managing Composio tool authorization
 *
 * @example
 * ```tsx
 * const { authState, authorize, isAuthorizing } = useComposioAuth({
 *   onSuccess: () => console.log('Authorized!'),
 *   userId: 'user@example.com'
 * });
 *
 * // Start authorization for a toolkit
 * await authorize('gmail');
 *
 * // If authState.authorizationUrl is set, show it to the user
 * ```
 */
export function useComposioAuth(options: UseComposioAuthOptions = {}): UseComposioAuthReturn {
  const { onSuccess, onError, userId = 'default-user', callbackUrl } = options;
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<Window | null>(null);

  const [authState, setAuthState] = useState<ComposioAuthState>({
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
      const response = await fetch('/api/integrations/composio/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkitSlug, userId, callbackUrl }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Authorization failed' }));
        throw new Error(error.message || 'Authorization failed');
      }

      return response.json() as Promise<{
        status: 'pending' | 'completed';
        authorizationId?: string;
        authorizationUrl?: string;
      }>;
    },
  });

  // Status check mutation
  const statusMutation = useMutation({
    mutationFn: async (authorizationId: string) => {
      const response = await fetch(`/api/integrations/composio/auth/status?authorizationId=${authorizationId}`);

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
          'composio_auth_popup',
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
