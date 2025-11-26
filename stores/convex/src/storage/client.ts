import type { StorageRequest, StorageResponse } from './types';

export type ConvexAdminClientConfig = {
  deploymentUrl: string;
  adminAuthToken: string;
  storageFunction?: string;
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

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
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
      const error = new Error(storageResponse?.error || 'Unknown Convex storage error');
      (error as any).code = storageResponse?.code;
      (error as any).details = storageResponse?.details;
      throw error;
    }

    return storageResponse.result as T;
  }
}
