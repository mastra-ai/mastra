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
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

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
  beforeEach(() => {
    mock.clearFixtures();
    mock.resetMatchCounts();
  });

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

  // Resumable chatRoute reconnects with getActiveThreadRunId → __getRunRecord → observe (#31068).
  it('reconnects to a running run the way a resumable chat route does', async () => {
    let releaseTool!: () => void;
    const toolStarted = Promise.withResolvers<void>();
    const wait = createTool({
      id: 'wait',
      description: 'Wait for a while',
      inputSchema: z.object({}),
      execute: async () => {
        toolStarted.resolve();
        await new Promise<void>(resolve => (releaseTool = resolve));
        return { waited: true };
      },
    });
    mock.on(
      { endpoint: 'chat', userMessage: 'Wait, then reply.', sequenceIndex: 0 },
      { toolCalls: [{ name: 'wait', arguments: '{}' }] },
    );
    mock.on({ endpoint: 'chat', userMessage: 'Wait, then reply.', sequenceIndex: 1 }, { content: 'Waited.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const agentId = `reconnect-agent-${generateTestId()}`;
    const mastra = getSharedMastra();
    const agent = new Agent({
      id: agentId,
      name: 'Reconnect Agent',
      instructions: 'Call wait, then reply.',
      model: openai('gpt-4o-mini'),
      tools: { wait },
      memory: new Memory({ storage: mastra.getStorage()! }),
    });
    mastra.addAgent(createInngestAgent({ agent, inngest: getSharedInngest() }), agentId);
    const inngestAgent = mastra.getAgent(agentId) as unknown as ReturnType<typeof createInngestAgent>;
    const threadId = `thread-${generateTestId()}`;
    const resourceId = 'user-1';

    const run = await inngestAgent.stream('Wait, then reply.', {
      maxSteps: 3,
      memory: { thread: threadId, resource: resourceId },
    });
    try {
      await toolStarted.promise;

      // The browser reloaded mid-run: find the run and its owner.
      const runId = inngestAgent.getActiveThreadRunId({ threadId, resourceId });
      expect(runId).toBe(run.runId);
      expect(await inngestAgent.__getRunRecord(runId!)).toMatchObject({
        agentId,
        runId,
        threadId,
        resourceId,
        status: 'running',
      });

      const observation = await inngestAgent.observe(runId!);
      releaseTool();
      const chunks: { type: string; payload?: any }[] = [];
      try {
        for await (const chunk of observation.fullStream) chunks.push(chunk);
      } finally {
        observation.detach();
      }
      expect(chunks.map(chunk => chunk.type)).toEqual(expect.arrayContaining(['tool-call', 'tool-result']));
      expect(chunks.at(-1)?.type).toBe('finish');

      await vi.waitFor(async () => expect((await inngestAgent.__getRunRecord(runId!))?.status).toBe('finished'), {
        timeout: 30_000,
      });
      expect(await inngestAgent.__getRunRecord('unknown-run')).toBeUndefined();
    } finally {
      releaseTool?.();
      await run.output.consumeStream().catch(() => {});
      run.cleanup?.();
    }
  });

  it("does not report another agent's run", async () => {
    mock.on({ endpoint: 'chat', userMessage: 'Other' }, { content: 'Other reply.' });
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
    const mastra = getSharedMastra();
    const [first, second] = ['a', 'b'].map(suffix => {
      const id = `record-owner-${suffix}-${generateTestId()}`;
      mastra.addAgent(
        createInngestAgent({
          agent: new Agent({ id, name: id, instructions: 'Reply.', model: openai('gpt-4o-mini') }),
          inngest: getSharedInngest(),
        }),
        id,
      );
      return mastra.getAgent(id) as unknown as ReturnType<typeof createInngestAgent>;
    });
    const run = await first!.stream('Other', { maxSteps: 1 });
    try {
      await run.output.consumeStream();
      await vi.waitFor(async () => expect((await first!.__getRunRecord(run.runId))?.status).toBe('finished'), {
        timeout: 30_000,
      });
      expect(await second!.__getRunRecord(run.runId)).toBeUndefined();
    } finally {
      run.cleanup?.();
    }
  });
});
