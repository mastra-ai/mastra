import type { StorageRequest, StorageResponse } from './types';

export type ConvexAdminClientConfig = {
  deploymentUrl: string;
  adminAuthToken: string;
  storageFunction?: string;
};

/** Response from callStorageRaw that includes batch info */
export type RawStorageResult<T = any> = {
  result: T;
  hasMore?: boolean;
};

const DEFAULT_STORAGE_FUNCTION = 'mastra/storage:handle';

export class ConvexAdminClient {
  private readonly deploymentUrl: string;
  private readonly adminAuthToken: string;
  private readonly storageFunction: string;

  constructor({ deploymentUrl, adminAuthToken, storageFunction }: ConvexAdminClientConfig) {
    if (!deploymentUrl) {
      throw new Error('ConvexAdminClient: deploymentUrl is required.');
    }

    if (!adminAuthToken) {
      throw new Error('ConvexAdminClient: adminAuthToken is required.');
    }

    this.deploymentUrl = deploymentUrl.replace(/\/$/, ''); // Remove trailing slash
    this.adminAuthToken = adminAuthToken;
    this.storageFunction = storageFunction ?? DEFAULT_STORAGE_FUNCTION;
  }

  /**
   * Call storage and return the full response including hasMore flag.
   * Use this for operations that may need multiple calls (e.g., clearTable).
   */
  async callStorageRaw<T = any>(request: StorageRequest): Promise<RawStorageResult<T>> {
    // Use Convex HTTP API directly with admin auth
    const url = `${this.deploymentUrl}/api/mutation`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Convex ${this.adminAuthToken}`,
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
    };
  }

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
    const { result } = await this.callStorageRaw<T>(request);
    return result;
  }
}
