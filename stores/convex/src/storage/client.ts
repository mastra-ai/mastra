import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import type { FunctionReference } from 'convex/server';

import type { StorageRequest, StorageResponse } from './types';

export type ConvexAdminClientConfig = {
  deploymentUrl: string;
  adminAuthToken: string;
  storageFunction?: string;
  fetchOptions?: {
    headers?: Record<string, string>;
  };
};

const DEFAULT_STORAGE_FUNCTION = 'mastra/storage:handle';

export class ConvexAdminClient {
  private readonly client: ConvexHttpClient;
  private readonly storageRef: FunctionReference<'mutation'>;

  constructor({ deploymentUrl, adminAuthToken, storageFunction, fetchOptions }: ConvexAdminClientConfig) {
    if (!deploymentUrl) {
      throw new Error('ConvexAdminClient: deploymentUrl is required.');
    }

    if (!adminAuthToken) {
      throw new Error('ConvexAdminClient: adminAuthToken is required.');
    }

    this.client = new ConvexHttpClient(deploymentUrl, {
      skipConvexDeploymentUrlCheck: true,
    });

    this.client.setAdminAuth(adminAuthToken);

    if (fetchOptions?.headers) {
      this.client.setFetchOptions({
        headers: fetchOptions.headers,
      });
    }

    const functionPath = storageFunction ?? DEFAULT_STORAGE_FUNCTION;
    this.storageRef = makeFunctionReference<'mutation', StorageRequest, StorageResponse>(functionPath);
  }

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
    const response = (await this.client.mutation(this.storageRef, request)) as StorageResponse;

    if (!response?.ok) {
      const error = new Error(response?.error || 'Unknown Convex storage error');
      (error as any).code = response?.code;
      (error as any).details = response?.details;
      throw error;
    }

    return response.result as T;
  }
}
