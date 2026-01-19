import type { StorageRequest, StorageResponse } from './types';

/**
 * Configuration for Convex client.
 *
 * Authentication options:
 * - `adminAuthToken`: Full admin access (use only during deployment/CI)
 * - `authToken`: User or service JWT token for runtime operations
 *
 * Security note: The adminAuthToken grants full access including destructive
 * operations. For production runtime, prefer using authToken with appropriate
 * permissions.
 */
export type ConvexAdminClientConfig = {
  /** The Convex deployment URL (e.g., https://your-deployment.convex.cloud) */
  deploymentUrl: string;

  /**
   * Admin auth token for full access.
   * WARNING: This token allows destructive operations. Use authToken for runtime.
   */
  adminAuthToken?: string;

  /**
   * User or service auth token (JWT) for runtime operations.
   * This is the recommended auth method for production runtime.
   */
  authToken?: string;

  /** Custom storage function path (default: 'mastra/storage:handle') */
  storageFunction?: string;
};

/** Response from callStorageRaw that includes batch info */
export type RawStorageResult<T = any> = {
  result: T;
  hasMore?: boolean;
  cursor?: string;
};

const DEFAULT_STORAGE_FUNCTION = 'mastra/storage:handle';

export class ConvexAdminClient {
  private readonly deploymentUrl: string;
  private readonly adminAuthToken?: string;
  private readonly authToken?: string;
  private readonly storageFunction: string;

  constructor({ deploymentUrl, adminAuthToken, authToken, storageFunction }: ConvexAdminClientConfig) {
    if (!deploymentUrl) {
      throw new Error('ConvexAdminClient: deploymentUrl is required.');
    }

    if (!adminAuthToken && !authToken) {
      throw new Error('ConvexAdminClient: Either adminAuthToken or authToken is required.');
    }

    this.deploymentUrl = deploymentUrl.replace(/\/$/, ''); // Remove trailing slash
    this.adminAuthToken = adminAuthToken;
    this.authToken = authToken;
    this.storageFunction = storageFunction ?? DEFAULT_STORAGE_FUNCTION;
  }

  /**
   * Get the authorization header value.
   * Prefers adminAuthToken if available, falls back to authToken.
   */
  private getAuthHeader(): string {
    if (this.adminAuthToken) {
      return `Convex ${this.adminAuthToken}`;
    }
    if (this.authToken) {
      return `Bearer ${this.authToken}`;
    }
    throw new Error('No auth token available');
  }

  /**
   * Call storage and return the full response including hasMore flag.
   * Use this for operations that may need multiple calls (e.g., clearTable).
   */
  async callStorageRaw<T = any>(request: StorageRequest): Promise<RawStorageResult<T>> {
    // Use Convex HTTP API directly with auth
    const url = `${this.deploymentUrl}/api/mutation`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify({
        path: this.storageFunction,
        args: request,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex API error: ${response.status} ${text}`);
    }

    const result = (await response.json()) as {
      status?: string;
      errorMessage?: string;
      errorCode?: string;
      value?: StorageResponse;
    };

    // Handle Convex response format
    if (result.status === 'error') {
      const error = new Error(result.errorMessage || 'Unknown Convex error');
      (error as any).code = result.errorCode;
      throw error;
    }

    const storageResponse = result.value as StorageResponse;
    if (!storageResponse?.ok) {
      const errResponse = storageResponse as { ok: false; error: string; code?: string; details?: Record<string, any> };
      const error = new Error(errResponse?.error || 'Unknown Convex storage error');
      (error as any).code = errResponse?.code;
      (error as any).details = errResponse?.details;
      throw error;
    }

    return {
      result: storageResponse.result as T,
      hasMore: storageResponse.hasMore,
      cursor: storageResponse.cursor,
    };
  }

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
    const { result } = await this.callStorageRaw<T>(request);
    return result;
  }

  /**
   * Check if the client is using admin auth.
   * Useful for determining if destructive operations are allowed.
   */
  isAdminAuth(): boolean {
    return !!this.adminAuthToken;
  }
}
