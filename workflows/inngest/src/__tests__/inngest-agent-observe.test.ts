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
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import type { ChunkType } from '@mastra/core/stream';
import { createTool } from '@mastra/core/tools';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { createInngestAgent } from '../durable-agent';
import { InngestDurableStepIds } from '../durable-agent/create-inngest-agentic-workflow';

import {
  generateTestId,
  getSharedInngest,
  getSharedMastra,
  INNGEST_PORT,
  setupSharedTestInfrastructure,
  teardownSharedTestInfrastructure,
} from './durable-agent.test.utils';

let mock: LLMock;

type Frame = ChunkType;

function journal(event: string, data: unknown) {
  const directory = process.env.STREAM_QUAL_INNGEST_EVIDENCE_DIR;
  if (!directory) return;
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    join(directory, 'observe.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), event, data })}\n`,
  );
}

async function drain(stream: ReadableStream<Frame>, frames: Frame[], until?: string) {
  const reader = stream.getReader();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel('qualification drain deadline');
  }, 30_000);
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      frames.push(next.value);
      journal('frame', next.value);
      if (next.value.type === until) break;
    }
    if (timedOut) throw new Error('Inngest qualification reader exceeded 30000ms');
  } finally {
    clearTimeout(timer);
    await reader.cancel();
    reader.releaseLock();
  }
}

function text(frames: Frame[]) {
  return frames
    .filter(frame => frame.type === 'text-delta')
    .map(frame => frame.payload?.text ?? '')
    .join('');
}

function registerAgent(tools: ConstructorParameters<typeof Agent>[0]['tools'] = {}) {
  const agentId = `qualify-observe-${generateTestId()}`;
  const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${mock.url.replace(/\/+$/, '')}/v1` });
  const agent = createInngestAgent({
    agent: new Agent({
      id: agentId,
      name: 'Qualification observer',
      instructions: 'Use the requested tool, then reply.',
      model: openai('gpt-4o-mini'),
      tools,
    }),
    inngest: getSharedInngest(),
  });
  getSharedMastra().addAgent(agent, agentId);
  return agent;
}

beforeEach(() => {
  mock.clearFixtures();
  mock.clearRequests();
});

beforeAll(async () => {
  mock = new LLMock({ port: 0 });
  await mock.start();
  await setupSharedTestInfrastructure();
  await vi.waitFor(
    async () => {
      const response = await fetch(`http://localhost:${INNGEST_PORT}/dev`);
      expect(response.ok).toBe(true);
      const registration = (await response.json()) as { functions?: { slug: string }[] };
      const slugs = registration.functions?.map(fn => fn.slug) ?? [];
      for (const id of [InngestDurableStepIds.AGENTIC_LOOP, InngestDurableStepIds.AGENTIC_EXECUTION]) {
        expect(slugs.some(slug => slug.endsWith(`workflow.${id}`))).toBe(true);
      }
      journal('registration', { slugs });
    },
    { timeout: 15_000, interval: 250 },
  );
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
      expect(mock.getRequests()).toHaveLength(1);
    } finally {
      run.cleanup?.();
    }
  });

  it('detaches mid-run without stopping execution and replays after reattachment', async () => {
    const reply = 'A paced reply keeps streaming after its first observer detaches and is replayed completely.';
    mock.on({ endpoint: 'chat' }, { content: reply }, { chunkSize: 2, latency: 40 });
    const agent = registerAgent();
    const run = await agent.stream('Reply slowly.');
    const live: Frame[] = [];
    const prefix: Frame[] = [];
    const replay: Frame[] = [];
    const liveDrain = drain(run.output.fullStream, live);
    try {
      const first = await agent.observe(run.runId);
      try {
        await drain(first.fullStream, prefix, 'text-delta');
      } finally {
        first.detach();
      }
      expect(prefix.at(-1)?.type).toBe('text-delta');
      expect(text(prefix).length).toBeGreaterThan(0);
      expect(text(prefix).length).toBeLessThan(reply.length);
      expect(live.some(frame => frame.type === 'finish')).toBe(false);
      const second = await agent.observe(run.runId, { offset: 0 });
      try {
        await drain(second.fullStream, replay);
      } finally {
        second.detach();
      }
      await liveDrain;
      expect(text(live)).toBe(reply);
      expect(text(replay)).toBe(reply);
      expect(replay).toEqual(live);
      expect(replay.filter(frame => frame.type === 'finish')).toHaveLength(1);
      expect(live.filter(frame => frame.type === 'finish')).toHaveLength(1);
      expect(live.some(frame => frame.type === 'abort' || frame.type === 'error')).toBe(false);
      expect(mock.getRequests()).toHaveLength(1);
    } finally {
      journal('reattach', { runId: run.runId, live, prefix, replay, requests: mock.getRequests() });
      run.cleanup();
      await liveDrain;
    }
  });

  it('resumes the named approval once while live and replay readers retain the same run', async () => {
    const toolCallId = `call-${generateTestId()}`;
    const effects: string[] = [];
    mock.on(
      { endpoint: 'chat', hasToolResult: false },
      {
        toolCalls: [{ id: toolCallId, name: 'qualifyEffect', arguments: { value: 'approved-effect' } }],
      },
    );
    mock.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Approved effect completed.' });
    const agent = registerAgent({
      qualifyEffect: createTool({
        id: 'qualifyEffect',
        description: 'Record one explicitly approved effect',
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        requireApproval: true,
        execute: async ({ value }) => {
          effects.push(value);
          journal('effect', { toolCallId, value });
          return { value };
        },
      }),
    });
    const run = await agent.stream('Record approved-effect.', { closeOnSuspend: true });
    const suspended: Frame[] = [];
    const replay: Frame[] = [];
    const resumedFrames: Frame[] = [];
    try {
      await drain(run.output.fullStream, suspended);
      expect(suspended.find(frame => frame.type === 'tool-call-approval')?.payload?.toolCallId).toBe(toolCallId);
      expect(effects).toEqual([]);
      const store = await getSharedMastra().getStorage()?.getStore('workflows');
      await vi.waitFor(
        async () => {
          const snapshot = await store?.loadWorkflowSnapshot({
            workflowName: InngestDurableStepIds.AGENTIC_LOOP,
            runId: run.runId,
          });
          expect(snapshot?.status).toBe('suspended');
          expect(Object.keys(snapshot?.resumeLabels ?? {})).toContain(toolCallId);
          journal('approval-ready', { runId: run.runId, snapshot });
        },
        { timeout: 15_000, interval: 100 },
      );
      const observer = await agent.observe(run.runId);
      try {
        const resumed = await agent.approveToolCall({ runId: run.runId, toolCallId });
        await Promise.all([drain(resumed.fullStream, resumedFrames), drain(observer.fullStream, replay)]);
        expect(text(resumedFrames)).toBe('Approved effect completed.');
        expect(text(replay)).toBe('Approved effect completed.');
        expect(resumedFrames.filter(frame => frame.type === 'finish')).toHaveLength(1);
        expect(replay.filter(frame => frame.type === 'finish')).toHaveLength(1);
        expect(resumedFrames.some(frame => frame.type === 'tool-call-approval' || frame.type === 'error')).toBe(false);
        expect(effects).toEqual(['approved-effect']);
        expect(mock.getRequests()).toHaveLength(2);
      } finally {
        observer.detach();
      }
    } finally {
      journal('approval', {
        runId: run.runId,
        toolCallId,
        suspended,
        replay,
        resumedFrames,
        effects,
        requests: mock.getRequests(),
      });
      run.cleanup();
    }
  });
});
