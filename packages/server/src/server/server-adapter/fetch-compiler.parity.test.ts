/**
 * PF-4446: fetch-compiler parity runner. Executes the shared
 * `@internal/server-adapter-test-utils` route suite against compiled fetch
 * handlers with no sockets: requests are built as WHATWG `Request` objects
 * and translated back to `HttpResponse`, so this proves behavioral parity
 * with the framework adapters through the same assertions they run.
 */
import type {
  AdapterSetupOptions,
  AdapterTestContext,
  HttpRequest,
  HttpResponse,
} from '@internal/server-adapter-test-utils';
import { createRouteAdapterTestSuite } from '@internal/server-adapter-test-utils';
import { describe } from 'vitest';

import { compileFetchRouter, type FetchRouter } from './fetch-compiler';
import { SERVER_ROUTES } from './routes';

async function executeFetchRequest(router: FetchRouter, httpRequest: HttpRequest): Promise<HttpResponse> {
  const url = new URL(`http://fetch${httpRequest.path}`);
  if (httpRequest.query) {
    for (const [key, value] of Object.entries(httpRequest.query)) {
      if (Array.isArray(value)) {
        for (const entry of value) url.searchParams.append(key, String(entry));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  const init: RequestInit = {
    method: httpRequest.method,
    headers: { 'Content-Type': 'application/json', ...(httpRequest.headers ?? {}) },
  };
  if (httpRequest.body !== undefined && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(httpRequest.method)) {
    init.body = typeof httpRequest.body === 'string' ? httpRequest.body : JSON.stringify(httpRequest.body);
  }
  const response = await router.fetch(new Request(url, init));
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const contentType = response.headers.get('content-type') ?? '';
  const isStream =
    contentType.includes('text/plain') ||
    contentType.includes('text/event-stream') ||
    contentType.includes('audio/') ||
    contentType.includes('application/octet-stream');
  if (isStream && response.body) {
    return { status: response.status, type: 'stream', stream: response.body, headers };
  }
  let data: unknown;
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  } else {
    data = await response.text();
  }
  return { status: response.status, type: 'json', data, headers };
}

describe('Fetch compiler adapter parity', () => {
  createRouteAdapterTestSuite({
    suiteName: 'Fetch Compiler Integration Tests',
    setupAdapter: async (context: AdapterTestContext, options?: AdapterSetupOptions) => {
      const router = compileFetchRouter(SERVER_ROUTES, {
        mastra: context.mastra,
        taskStore: context.taskStore,
        customRouteAuthConfig: context.customRouteAuthConfig,
        prefix: options?.prefix,
      });
      return { adapter: null, app: router };
    },
    executeHttpRequest: async (app: FetchRouter, httpRequest: HttpRequest) =>
      executeFetchRequest(app, httpRequest),
  });
});
