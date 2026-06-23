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
  continuationCursor?: string | null;
};

const DEFAULT_STORAGE_FUNCTION = 'mastra/storage:handle';

type ConvexFunctionKind = 'action' | 'mutation' | 'query';

type ConvexHttpSuccess<T> = {
  status: 'success';
  value: T;
  logLines?: string[];
};

type ConvexHttpResponse<T> =
  | {
      status: 'success';
      value: T;
      logLines?: string[];
    }
  | {
      status: 'error';
      errorMessage: string;
      errorData?: unknown;
      logLines?: string[];
    };

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
    const result = await this.callConvexFunction<StorageResponse>('mutation', this.storageFunction, request);

    const storageResponse = result.value;
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
      continuationCursor: storageResponse.continuationCursor,
    };
  }

  async callStorage<T = any>(request: StorageRequest): Promise<T> {
    const { result } = await this.callStorageRaw<T>(request);
    return result;
  }

  async callAction<T = any>(path: string, args: Record<string, any>): Promise<T> {
    return this.callFunction<T>('action', path, args);
  }

  async callMutation<T = any>(path: string, args: Record<string, any>): Promise<T> {
    return this.callFunction<T>('mutation', path, args);
  }

  async callQuery<T = any>(path: string, args: Record<string, any>): Promise<T> {
    return this.callFunction<T>('query', path, args);
  }

  private async callFunction<T>(kind: ConvexFunctionKind, path: string, args: Record<string, any>): Promise<T> {
    const result = await this.callConvexFunction<T>(kind, path, args);
    return result.value;
  }

  private async callConvexFunction<T>(
    kind: ConvexFunctionKind,
    path: string,
    args: Record<string, any>,
  ): Promise<ConvexHttpSuccess<T>> {
    const url = `${this.deploymentUrl}/api/${kind}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Convex ${this.adminAuthToken}`,
      },
      body: JSON.stringify({
        path,
        args,
        format: 'json',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex API error: ${response.status} ${text}`);
    }

    const result = (await response.json()) as ConvexHttpResponse<T>;

    if (result.status === 'error') {
      const error = new Error(result.errorMessage || 'Unknown Convex error');
      (error as any).details = result.errorData;
      throw error;
    }

    if (result.status !== 'success') {
      throw new Error(`Convex ${kind} ${path} returned an invalid response`);
    }

    if (result.value === undefined) {
      throw new Error(`Convex ${kind} ${path} returned no value`);
    }

    return result;
  }
}
