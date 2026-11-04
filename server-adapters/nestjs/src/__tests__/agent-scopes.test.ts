import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import type { Processor } from '@mastra/core/processors';
import { MASTRA_SCOPES_KEY } from '@mastra/core/request-context';
import { createMockModel } from '@mastra/core/test-utils/llm-mock';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import express from 'express';
import type { Application } from 'express';
import { afterEach, describe, expect, it } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

function setup() {
  const seen: unknown[] = [];
  const recorder: Processor = {
    id: 'scope-recorder',
    processInput: async ({ messages, requestContext }) => {
      seen.push(requestContext?.get(MASTRA_SCOPES_KEY) ?? null);
      return messages;
    },
  };
  const agent = new Agent({
    id: 'scoped',
    name: 'scoped',
    instructions: 'Reply briefly.',
    model: createMockModel({ mockText: 'ok' }),
    inputProcessors: [recorder],
  });
  return { mastra: new Mastra({ agents: { scoped: agent } }), seen };
}

describe('NestJS adapter - agent scopes', () => {
  let nestApp: INestApplication | null = null;

  afterEach(async () => {
    await nestApp?.close();
    nestApp = null;
  });

  async function start(mastra: Mastra) {
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra })],
    }).compile();
    nestApp = moduleRef.createNestApplication();
    const expressApp = nestApp.getHttpAdapter().getInstance() as Application;
    expressApp.use(express.json());
    await nestApp.init();
    return expressApp;
  }

  it('registers a server that reserves agent scopes, so in-process calls keep their scopes', async () => {
    const { mastra, seen } = setup();
    await start(mastra);

    await mastra.getAgent('scoped').generate('hi', { scopes: ['org:acme'] });
    expect(seen).toEqual([['org:acme']]);
    expect((mastra.getMastraServer() as { reservesAgentScopes?: boolean }).reservesAgentScopes).toBe(true);
  });

  it('never lets a request body supply scopes', async () => {
    const { mastra, seen } = setup();
    const app = await start(mastra);

    const response = await executeExpressRequest(app, {
      method: 'POST',
      path: '/api/agents/scoped/generate',
      body: {
        messages: [{ role: 'user', content: 'hi' }],
        scopes: ['org:victim'],
        requestContext: { [MASTRA_SCOPES_KEY]: ['org:victim'] },
      },
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual([null]);
  });
});
