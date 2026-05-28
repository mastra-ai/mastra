import type { CacheRequest, CacheResponse } from './types';

export type ConvexCacheClientConfig = {
  deploymentUrl: string;
  adminAuthToken: string;
  cacheFunction?: string;
  requestTimeoutMs?: number;
};

export type RawCacheResult<T = unknown> = {
  result: T;
  hasMore?: boolean;
};

const DEFAULT_CACHE_FUNCTION = 'mastra/cache:handle';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

const trimTrailingSlashes = (value: string): string => {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
};

export class ConvexCacheClient {
  private readonly deploymentUrl: string;
  private readonly adminAuthToken: string;
  private readonly cacheFunction: string;
  private readonly requestTimeoutMs: number;

  constructor({ deploymentUrl, adminAuthToken, cacheFunction, requestTimeoutMs }: ConvexCacheClientConfig) {
    const normalizedDeploymentUrl = deploymentUrl.trim();
    const normalizedAdminAuthToken = adminAuthToken.trim();
    const normalizedCacheFunction = cacheFunction?.trim();

    if (!normalizedDeploymentUrl) {
      throw new Error('ConvexCacheClient: deploymentUrl is required.');
    }

    if (!normalizedAdminAuthToken) {
      throw new Error('ConvexCacheClient: adminAuthToken is required.');
    }

    if (requestTimeoutMs !== undefined && requestTimeoutMs < 0) {
      throw new Error('ConvexCacheClient: requestTimeoutMs must be greater than or equal to 0.');
    }

    this.deploymentUrl = trimTrailingSlashes(normalizedDeploymentUrl);
    this.adminAuthToken = normalizedAdminAuthToken;
    this.cacheFunction = normalizedCacheFunction || DEFAULT_CACHE_FUNCTION;
    this.requestTimeoutMs = requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  async callCacheRaw<T = unknown>(request: CacheRequest): Promise<RawCacheResult<T>> {
    const controller = this.requestTimeoutMs > 0 ? new AbortController() : undefined;
    const timeoutId = controller ? setTimeout(() => controller.abort(), this.requestTimeoutMs) : undefined;
    let response: Response;

    try {
      response = await fetch(`${this.deploymentUrl}/api/mutation`, {
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
        signal: controller?.signal,
      });
    } catch (error) {
      if (controller?.signal.aborted) {
        throw new Error(`Convex cache request timed out after ${this.requestTimeoutMs} ms.`);
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Convex API error: ${response.status} ${text}`);
    }

    const result = (await response.json()) as {
      status?: string;
      errorMessage?: string;
      errorCode?: string;
      code?: string;
      details?: Record<string, unknown>;
      value?: CacheResponse;
    };

    if (result.status === 'error') {
      const error = new Error(result.errorMessage || 'Unknown Convex error');
      (error as any).code = result.errorCode ?? result.code;
      (error as any).details = result.details;
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
