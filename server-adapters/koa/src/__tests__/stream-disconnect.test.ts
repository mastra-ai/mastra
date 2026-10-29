import type { Server } from 'node:http';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('Koa stream client disconnect', () => {
  let llm: LLMock;
  let server: Server;
  let port: number;
  const toolState = { calls: 0, abortSignalsFired: 0 };

  beforeEach(async () => {
    toolState.calls = 0;
    toolState.abortSignalsFired = 0;

    llm = new LLMock({ port: 0 });
    await llm.start();
    // Every turn answers with another tool call, so the agent loops until it is aborted or hits maxSteps.
    llm.on({ userMessage: 'loop' }, { toolCalls: [{ name: 'tick', arguments: '{}' }] });

    const tick = createTool({
      id: 'tick',
      description: 'tick',
      inputSchema: z.object({}),
      execute: async (_input, context) => {
        toolState.calls++;
        context?.abortSignal?.addEventListener('abort', () => toolState.abortSignalsFired++, { once: true });
        await sleep(100);
        return 'ticked';
      },
    });

    const agent = new Agent({
      id: 'looper',
      name: 'looper',
      instructions: 'Call tick.',
      model: { id: 'openai/gpt-4o-mini', url: `${llm.url.replace(/\/+$/, '')}/v1`, apiKey: 'test-key' },
      tools: { tick },
    });

    const app = new Koa();
    app.use(bodyParser());
    await new MastraServer({ app, mastra: new Mastra({ agents: { looper: agent }, logger: false }) }).init();
    server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 0;
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
    await llm.stop();
  });

  it('aborts the agent run when the client disconnects mid-stream', async () => {
    const controller = new AbortController();
    const res = await fetch(`http://localhost:${port}/api/agents/looper/stream`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: 'loop', maxSteps: 50 }),
      signal: controller.signal,
    });
    expect(res.status).toBe(200);

    const reader = res.body!.getReader();
    while (toolState.calls < 2) {
      const { done } = await reader.read();
      if (done) throw new Error('stream ended before the agent looped');
    }
    controller.abort();
    const modelCallsAtAbort = llm.getRequests().length;

    await sleep(1500);

    expect(toolState.abortSignalsFired).toBeGreaterThan(0);
    // At most the in-flight step finishes; the loop must not keep calling the model.
    expect(llm.getRequests().length - modelCallsAtAbort).toBeLessThanOrEqual(1);
  });
});
