/**
 * Regression test for COR-1525: reading `observe(runId).fullStream` on an agent created with
 * `createInngestAgent` threw `Cannot read private member #options from an object whose class did
 * not declare it` on the first read.
 *
 * Technical: the Inngest `observe()` override wraps `fullStream` and called the base getter with the
 * destructurable proxy as receiver, which cannot reach `MastraModelOutput`'s private fields. Core's
 * `DurableAgent.observe()` calls it with the real instance.
 *
 * Runs on a real Inngest dev server, with the model served by aimock over HTTP.
 */
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createInngestAgent } from '../durable-agent';
import {
  generateTestId,
  getSharedInngest,
  getSharedMastra,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

let mock: LLMock;

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
  await setupSharedTestInfrastructure();
});

afterAll(async () => {
  await teardownSharedTestInfrastructure();
  await mock?.stop();
});

describe('Inngest agent observe()', () => {
  it('replays a finished run through observe(runId).fullStream', async () => {
    mock.on({ endpoint: 'chat' }, { content: 'Finished reply.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const agentId = `observe-agent-${generateTestId()}`;
    const agent = new Agent({
      id: agentId,
      name: 'Observe Agent',
      instructions: 'Reply briefly.',
      model: openai('gpt-4o-mini'),
    });
    const mastra = getSharedMastra();
    mastra.addAgent(createInngestAgent({ agent, inngest: getSharedInngest() }), agentId);
    const inngestAgent = mastra.getAgent(agentId) as unknown as ReturnType<typeof createInngestAgent>;

    const run = await inngestAgent.stream('Go', { maxSteps: 2 });
    try {
      await run.output.consumeStream();

      const observation = await inngestAgent.observe(run.runId);
      const chunks: { type: string; payload?: any }[] = [];
      try {
        for await (const chunk of observation.fullStream) chunks.push(chunk);
      } finally {
        observation.detach();
      }

      const text = chunks
        .filter(chunk => chunk.type === 'text-delta')
        .map(chunk => chunk.payload.text)
        .join('');
      expect(text).toBe('Finished reply.');
      expect(chunks.at(-1)?.type).toBe('finish');
    } finally {
      run.cleanup?.();
    }
  });
});
