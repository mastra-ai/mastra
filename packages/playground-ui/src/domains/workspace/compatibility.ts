import { coreFeatures } from '@mastra/core/features';
import { MastraClient } from '@mastra/client-js';
import { hasMethod } from './client-utils';

/**
 * Checks if workspace v1 features are supported by both core and client.
 * This guards against version mismatches between playground-ui, core, and client-js.
 */
export const isWorkspaceV1Supported = (client: MastraClient) => {
  const workspaceClientMethods = ['listWorkspaces', 'getWorkspace'];

  const coreSupported = coreFeatures.has('workspaces-v1');
  const clientSupported = workspaceClientMethods.every(method => hasMethod(client, method));

  return coreSupported && clientSupported;
};

/**
 * Checks if an error is a "Not Implemented" (501) error from the server.
 * This indicates the server's @mastra/core version doesn't support workspaces.
 */
export const isWorkspaceNotSupportedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  // Check for status property (from fetch Response or similar)
  if ('status' in error && (error as { status: number }).status === 501) {
    return true;
  }

  // Check for statusCode property (from some HTTP clients)
  if ('statusCode' in error && (error as { statusCode: number }).statusCode === 501) {
    return true;
  }

  // Check error message for our specific error
  if ('message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('Workspace v1 not supported') || message.includes('501');
  }

  return false;
};

/**
 * React Query retry function that doesn't retry on 501 errors.
 * Use this to prevent infinite retries when workspaces aren't supported.
 */
export const shouldRetryWorkspaceQuery = (failureCount: number, error: unknown): boolean => {
  // Don't retry 501 "Not Implemented" errors - they won't resolve with retries
  if (isWorkspaceNotSupportedError(error)) {
    return false;
  }
  // Default retry behavior: retry up to 3 times
  return failureCount < 3;
};
