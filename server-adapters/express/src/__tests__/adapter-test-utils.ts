import express from 'express';
import request from 'supertest';
import { ReadableStream } from 'node:stream/web';
import { ExpressServerAdapter } from '../index';
import type { Tool } from '@mastra/core/tools';
import type { Mastra } from '@mastra/core/mastra';
import type { InMemoryTaskStore } from '@mastra/server/a2a/store';
import type { BodyLimitOptions, ServerRoute } from '@mastra/server/server-adapter';
import type {
  RouteExecutionContext,
  RouteExecutionResult,
} from '../../../../packages/server/src/server/server-adapter/routes/__tests__/route-adapter-test-suite';

export interface ExpressExecuteOptions {
  mastra: Mastra;
  tools?: Record<string, Tool>;
  taskStore?: InMemoryTaskStore;
  customRouteAuthConfig?: Map<string, boolean>;
  playground?: boolean;
  isDev?: boolean;
  bodyLimitOptions?: BodyLimitOptions;
}

export function createExpressRouteExecutor(options: ExpressExecuteOptions) {
  return async ({ route, request: reqPayload }: RouteExecutionContext): Promise<RouteExecutionResult> => {
    const app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    const adapter = new ExpressServerAdapter({
      mastra: options.mastra,
      tools: options.tools,
      taskStore: options.taskStore,
      customRouteAuthConfig: options.customRouteAuthConfig,
      playground: options.playground,
      isDev: options.isDev,
      bodyLimitOptions: options.bodyLimitOptions,
    });

    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route as ServerRoute, { prefix: '' });

    let path = reqPayload.path;
    if (reqPayload.query) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(reqPayload.query)) {
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, v));
        } else {
          searchParams.append(key, value);
        }
      }
      const queryString = searchParams.toString();
      if (queryString) {
        path = `${path}?${queryString}`;
      }
    }

    const method = reqPayload.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
    let testRequest = request(app)[method](path);

    if (reqPayload.body !== undefined) {
      testRequest = testRequest.send(reqPayload.body).set('Content-Type', 'application/json');
    }

    const res = await testRequest;

    const headers = (res.headers ?? {}) as Record<string, string>;
    const statusCode = typeof res.status === 'number' ? res.status : res.statusCode ?? 500;

    if (route.responseType === 'json') {
      let data: unknown = res.body;
      if (data === undefined) {
        const bodyText = res.text ?? '';
        if (bodyText.length > 0) {
          try {
            data = JSON.parse(bodyText);
          } catch {
            data = bodyText;
          }
        }
      }

      return {
        type: 'json',
        status: statusCode,
        data,
        headers,
      };
    }

    const responseText = res.text ?? '';
    const stream = new ReadableStream({
      start(controller) {
        if (responseText) {
          controller.enqueue(responseText);
        }
        controller.close();
      },
    });

    return {
      type: 'stream',
      status: statusCode,
      stream,
      headers,
    };
  };
}
