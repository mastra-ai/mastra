import type { CacheRequest, CacheResponse } from './types';

export type ConvexCacheClientConfig = {
  deploymentUrl: string;
  adminAuthToken: string;
  cacheFunction?: string;
};

export type RawCacheResult<T = unknown> = {
  result: T;
  hasMore?: boolean;
};

const DEFAULT_CACHE_FUNCTION = 'mastra/cache:handle';

export class ConvexCacheClient {
  private readonly deploymentUrl: string;
  private readonly adminAuthToken: string;
  private readonly cacheFunction: string;

  constructor({ deploymentUrl, adminAuthToken, cacheFunction }: ConvexCacheClientConfig) {
    if (!deploymentUrl) {
      throw new Error('ConvexCacheClient: deploymentUrl is required.');
    }

    if (!adminAuthToken) {
      throw new Error('ConvexCacheClient: adminAuthToken is required.');
    }

    this.deploymentUrl = deploymentUrl.replace(/\/$/, '');
    this.adminAuthToken = adminAuthToken;
    this.cacheFunction = cacheFunction ?? DEFAULT_CACHE_FUNCTION;
  }

  async callCacheRaw<T = unknown>(request: CacheRequest): Promise<RawCacheResult<T>> {
    const response = await fetch(`${this.deploymentUrl}/api/mutation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Convex ${this.adminAuthToken}`,
      },
      body: JSON.stringify({
        path: this.cacheFunction,
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
      value?: CacheResponse;
    };

    if (result.status === 'error') {
      const error = new Error(result.errorMessage || 'Unknown Convex error');
      (error as any).code = result.errorCode;
      throw error;
    }

    const cacheResponse = result.value as CacheResponse;
    if (!cacheResponse?.ok) {
      const errResponse = cacheResponse as { ok: false; error: string; code?: string; details?: Record<string, any> };
      const error = new Error(errResponse?.error || 'Unknown Convex cache error');
      (error as any).code = errResponse?.code;
      (error as any).details = errResponse?.details;
      throw error;
    }

    return {
      result: cacheResponse.result as T,
      hasMore: cacheResponse.hasMore,
    };
  }

  async callCache<T = unknown>(request: CacheRequest): Promise<T> {
    const { result } = await this.callCacheRaw<T>(request);
    return result;
  }
}
