import { Readable } from 'node:stream';
import {
  createDefaultTestContext,
  createStreamWithSensitiveData,
  consumeSSEStream,
} from '@internal/server-adapter-test-utils';
import type { AdapterTestContext } from '@internal/server-adapter-test-utils';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { afterAll, beforeAll, describe, expect, it, beforeEach, afterEach } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

describe('NestJS Adapter - Stream Data Redaction', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  const streamRouteV2: ServerRoute<any, any, any> = {
    method: 'POST',
    path: '/test/stream',
    responseType: 'stream',
    streamFormat: 'sse',
    handler: async () => createStreamWithSensitiveData('v2'),
  };

  const streamRouteV1: ServerRoute<any, any, any> = {
    method: 'POST',
    path: '/test/stream-v1',
    responseType: 'stream',
    streamFormat: 'sse',
    handler: async () => createStreamWithSensitiveData('v1'),
  };

  const registerRoute = (route: ServerRoute) => {
    SERVER_ROUTES.push(route);
  };

  const unregisterRoute = (route: ServerRoute) => {
    const index = SERVER_ROUTES.indexOf(route);
    if (index >= 0) {
      SERVER_ROUTES.splice(index, 1);
    }
  };

  const setupApp = async (redact?: boolean) => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        MastraModule.register({
          mastra: context.mastra,
          prefix: '',
          streamOptions: redact === undefined ? undefined : { redact },
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
  };

  const consumeStream = async (path: string) => {
    const response = await executeExpressRequest(expressApp, {
      method: 'POST',
      path,
      body: {},
    });

    expect(response.status).toBe(200);
    if (!response.stream) {
      throw new Error(
        `Expected streaming response, got headers: ${JSON.stringify(response.headers)} body: ${JSON.stringify(response.body)}`,
      );
    }

    const webStream = Readable.toWeb(response.stream as any) as ReadableStream<Uint8Array>;
    return consumeSSEStream(webStream);
  };

  beforeAll(() => {
    registerRoute(streamRouteV2);
    registerRoute(streamRouteV1);
  });

  afterAll(() => {
    unregisterRoute(streamRouteV2);
    unregisterRoute(streamRouteV1);
  });

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should redact sensitive data from stream chunks by default', async () => {
    await setupApp();
    const chunks = await consumeStream('/test/stream');

    const allChunksStr = JSON.stringify(chunks);
    expect(allChunksStr).not.toContain('SECRET_SYSTEM_PROMPT');
    expect(allChunksStr).not.toContain('secret_tool');

    const stepStart = chunks.find(c => c.type === 'step-start');
    expect(stepStart).toBeDefined();
    expect(stepStart.payload.request).toEqual({});

    const stepFinish = chunks.find(c => c.type === 'step-finish');
    expect(stepFinish).toBeDefined();
    expect(stepFinish.payload.metadata.request).toBeUndefined();
    expect(stepFinish.payload.output.steps[0].request).toBeUndefined();

    const finish = chunks.find(c => c.type === 'finish');
    expect(finish).toBeDefined();
    expect(finish.payload.metadata.request).toBeUndefined();
  });

  it('should NOT redact sensitive data when streamOptions.redact is false', async () => {
    await setupApp(false);
    const chunks = await consumeStream('/test/stream');

    const allChunksStr = JSON.stringify(chunks);
    expect(allChunksStr).toContain('SECRET_SYSTEM_PROMPT');
    expect(allChunksStr).toContain('secret_tool');

    const stepStart = chunks.find(c => c.type === 'step-start');
    expect(stepStart).toBeDefined();
    expect(stepStart.payload.request.body).toContain('SECRET_SYSTEM_PROMPT');
  });

  it('should redact v1 format stream chunks', async () => {
    await setupApp();
    const chunks = await consumeStream('/test/stream-v1');

    const allChunksStr = JSON.stringify(chunks);
    expect(allChunksStr).not.toContain('SECRET_SYSTEM_PROMPT');
    expect(allChunksStr).not.toContain('secret_tool');

    const stepStart = chunks.find(c => c.type === 'step-start');
    expect(stepStart).toBeDefined();
    expect(stepStart.request).toEqual({});

    const stepFinish = chunks.find(c => c.type === 'step-finish');
    expect(stepFinish).toBeDefined();
    expect(stepFinish.request).toBeUndefined();
  });

  it('should pass through non-sensitive chunk types unchanged', async () => {
    await setupApp();
    const chunks = await consumeStream('/test/stream');

    const textDelta = chunks.find(c => c.type === 'text-delta');
    expect(textDelta).toBeDefined();
    expect(textDelta.textDelta).toBe('Hello');
  });
});
