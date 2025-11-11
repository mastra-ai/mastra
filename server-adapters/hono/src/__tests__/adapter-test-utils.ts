import { Hono } from 'hono';
import { ReadableStream } from 'node:stream/web';
import { HonoServerAdapter } from '../index';
import type { Tool } from '@mastra/core/tools';
import type { Mastra } from '@mastra/core/mastra';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { BodyLimitOptions, ServerRoute } from '@mastra/server/server-adapter';
import type {
  RouteExecutionContext,
  RouteExecutionResult,
} from '../../../../packages/server/src/server/server-adapter/routes/__tests__/route-adapter-test-suite';

export interface HonoExecuteOptions {
  mastra: Mastra;
  tools?: Record<string, Tool>;
  taskStore?: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  playground?: boolean;
  isDev?: boolean;
  bodyLimitOptions?: BodyLimitOptions;
}

export function createHonoRouteExecutor(options: HonoExecuteOptions) {
  return async ({ route, request }: RouteExecutionContext): Promise<RouteExecutionResult> => {
    const app = new Hono();
    const adapter = new HonoServerAdapter({
      mastra: options.mastra,
      tools: options.tools,
      taskStore: options.taskStore,
      customRouteAuthConfig: options.customRouteAuthConfig,
      playground: options.playground,
      isDev: options.isDev,
      bodyLimitOptions: options.bodyLimitOptions,
    });

    app.use('*', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route as ServerRoute, { prefix: '' });

    const url = new URL(`http://mastra.test${request.path}`);
    if (request.query) {
      for (const [key, value] of Object.entries(request.query)) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.append(key, value);
        }
      }
    }

    const headers = new Headers();
    if (request.body !== undefined) {
      headers.set('content-type', 'application/json');
    }

    const init: RequestInit = {
      method: request.method,
      headers,
    };

    if (request.body !== undefined) {
      init.body = JSON.stringify(request.body);
    }

      const response = await app.request(url.toString(), init);
    const responseHeaders: Record<string, string> = {};
    if (response.headers && typeof response.headers.forEach === 'function') {
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
    }

    const statusCode = typeof response.status === 'number' ? response.status : 500;

    if (route.responseType === 'json') {
      const bodyText = await response.text();
      let data: unknown = undefined;
      if (bodyText.length > 0) {
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = bodyText;
        }
      }
      return {
        type: 'json',
        status: statusCode,
        data,
        headers: responseHeaders,
      };
    }

    const stream =
      response.body ??
      new ReadableStream({
        start(controller) {
          controller.close();
        },
      });

    return {
      type: 'stream',
      status: statusCode,
      stream,
      headers: responseHeaders,
    };
  };
}
