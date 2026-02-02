import { coreFeatures } from '@mastra/core/features';
import { MastraClient } from '@mastra/client-js';
import { hasMethod } from './client-utils';
import { isNonRetryableError } from '../../lib/query-utils';

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
 * Checks if an error has a specific HTTP status code.
 * Supports MastraClientError, fetch Response, and other HTTP client error formats.
 */
const hasStatusCode = (error: unknown, statusCode: number): boolean => {
  if (!error || typeof error !== 'object') return false;

  // Check for status property (MastraClientError, fetch Response, etc.)
  if ('status' in error && (error as { status: number }).status === statusCode) {
    return true;
  }

  // Check for statusCode property (from some HTTP clients)
  if ('statusCode' in error && (error as { statusCode: number }).statusCode === statusCode) {
    return true;
  }

  return false;
};

/**
 * Checks if an error is a "Not Implemented" (501) error from the server.
 * This indicates the server's @mastra/core version doesn't support workspaces.
 */
export const isWorkspaceNotSupportedError = (error: unknown): boolean => {
  if (hasStatusCode(error, 501)) {
    return true;
  }

  // Check error message for our specific error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('Workspace v1 not supported') || message.includes('501');
  }

  return false;
};

/**
 * Checks if an error is a "Not Found" (404) error from the server.
 * This indicates the requested resource doesn't exist (e.g., file not found).
 */
export const isNotFoundError = (error: unknown): boolean => {
  if (hasStatusCode(error, 404)) {
    return true;
  }

  // Check error message for status code (client-js throws Error with message like "HTTP error! status: 404 - ...")
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('status: 404');
  }

  return false;
};

/**
 * React Query retry function that doesn't retry on 404, 501, or other 4xx client errors.
 * Use this to prevent infinite retries when resources don't exist, workspaces aren't supported, or access is denied.
 */
export const shouldRetryWorkspaceQuery = (failureCount: number, error: unknown): boolean => {
  // Don't retry 404 "Not Found" errors - the resource doesn't exist
  if (isNotFoundError(error)) {
    return false;
  }
  // Don't retry 501 "Not Implemented" errors - they won't resolve with retries
  if (isWorkspaceNotSupportedError(error)) {
    return false;
  }
  // Don't retry 4xx client errors (400, 401, 403, 404)
  if (isNonRetryableError(error)) {
    return false;
  }
  // Default retry behavior: retry up to 3 times
  return failureCount < 3;
};
