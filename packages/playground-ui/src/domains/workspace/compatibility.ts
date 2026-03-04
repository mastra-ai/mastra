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
 * Gets the HTTP status code from an error if present.
 * Supports MastraClientError, fetch Response, and other HTTP client error formats.
 */
const getStatusCode = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') return undefined;

  // Check for status property (MastraClientError, fetch Response, etc.)
  if ('status' in error && typeof (error as { status: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }

  // Check for statusCode property (from some HTTP clients)
  if ('statusCode' in error && typeof (error as { statusCode: unknown }).statusCode === 'number') {
    return (error as { statusCode: number }).statusCode;
  }

  return undefined;
};

/**
 * Checks if an error has a specific HTTP status code.
 * Supports MastraClientError, fetch Response, and other HTTP client error formats.
 */
const hasStatusCode = (error: unknown, statusCode: number): boolean => {
  return getStatusCode(error) === statusCode;
};

/**
 * Checks if an error is a 4xx client error (e.g., 400, 401, 403, 404).
 * Client errors won't resolve with retries.
 */
const isClientError = (error: unknown): boolean => {
  const status = getStatusCode(error);
  return status !== undefined && status >= 400 && status < 500;
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
 * React Query retry function that doesn't retry on client errors (4xx) or 501 errors.
 * Use this to prevent infinite retries when resources don't exist, access is denied, or workspaces aren't supported.
 */
export const shouldRetryWorkspaceQuery = (failureCount: number, error: unknown): boolean => {
  // Don't retry 4xx client errors (400, 401, 403, 404, etc.) - these won't resolve with retries
  if (isClientError(error)) {
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
