/**
 * Regression test for #26871: a tool call that parks after its run was aborted
 * must still stream to the Session when it is resumed. The resume reuses the
 * aborted run id, which the live subscription used to drop as trailing chunks
 * of the aborted run, so `respondToToolSuspension()` never resolved.
 */
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../../agent';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';
import { askUserTool } from '../../tools/builtin/ask-user';
import { AgentController } from '../agent-controller';
import { createMockWorkspace } from '../test-utils';
import type { AgentControllerEvent } from '../types';

vi.setConfig({ testTimeout: 30_000 });

function stream(chunks: unknown[]) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({ type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) });
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function slowAndAskStream() {
  return stream([
    { type: 'tool-call', toolCallId: 'slow-1', toolName: 'slow_tool', input: '{}', providerExecuted: false },
    {
      type: 'tool-call',
      toolCallId: 'ask-1',
      toolName: 'ask_user',
      input: JSON.stringify({ question: 'Which one?' }),
      providerExecuted: false,
    },
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);
}

function textStream(text: string) {
  return stream([
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage },
  ]);
}

async function createHarness(id: string, streams: Array<() => ReadableStream>) {
  const slowStarted = Promise.withResolvers<void>();
  const releaseSlow = Promise.withResolvers<void>();
  const slowTool = createTool({
    id: 'slow_tool',
    description: 'Takes a while.',
    inputSchema: z.object({}),
    execute: async () => {
      slowStarted.resolve();
      await releaseSlow.promise;
      return { ok: true };
    },
  });

  const storage = new InMemoryStore();
  let modelCalls = 0;
  const agent = new Agent({
    id: `${id}-agent`,
    name: `${id} agent`,
    instructions: 'You do things.',
    memory: new MockMemory({ storage }),
    model: new MastraLanguageModelV2Mock({
      doStream: async () => {
        const next = streams[Math.min(modelCalls, streams.length - 1)]!;
        modelCalls++;
        return { stream: next() };
      },
    }),
    tools: { slow_tool: slowTool, ask_user: askUserTool },
  });
  const mastra = new Mastra({ agents: { [`${id}-agent`]: agent }, logger: false, storage });
  const registeredAgent = mastra.getAgent(`${id}-agent`);
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: `${id}-controller`,
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
    initialState: { yolo: true } as any,
  });
  await controller.init();
  const session = await controller.createSession({ id: `${id}-session`, ownerId: 'owner-1' });
  await session.thread.create();

  const events: AgentControllerEvent[] = [];
  session.subscribe(event => {
    events.push(event);
  });

  return { session, agent: registeredAgent, events, slowStarted, releaseSlow, modelCalls: () => modelCalls };
}

/** Abort while `slow_tool` runs so `ask_user` parks after the abort. */
async function abortWhileSlowToolRuns(harness: Awaited<ReturnType<typeof createHarness>>) {
  const { session, agent, events, slowStarted, releaseSlow } = harness;
  const sending = session.sendMessage({ content: 'do both' }).catch(() => {});
  await slowStarted.promise;
  session.abort();
  releaseSlow.resolve();
  await vi.waitFor(() => expect(events.some(e => e.type === 'agent_end' && e.reason === 'aborted')).toBe(true));
  await sending;

  const threadId = session.thread.requireId();
  const resourceId = session.identity.getResourceId();
  let parked: { runId: string; toolCallId: string } | undefined;
  await vi.waitFor(async () => {
    const { runs } = await agent.listSuspendedRuns({ threadId, resourceId });
    const run = runs.find(r => r.toolCalls.some(call => call.toolCallId === 'ask-1'));
    expect(run).toBeDefined();
    parked = { runId: run!.runId, toolCallId: 'ask-1' };
  });
  if (!session.suspensions.has({ toolCallId: 'ask-1' })) {
    session.suspensions.register({ ...parked!, toolName: 'ask_user', threadId, resourceId });
  }
  return parked!;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)),
  ]);
}

describe('resuming a tool call parked after an abort (#26871)', () => {
  it('Given ask_user parked after an abort, When the user answers, Then the resumed run streams to completion on the Session', async () => {
    const harness = await createHarness('abort-resume', [slowAndAskStream, () => textStream('thanks')]);
    const { session, events } = harness;
    const parked = await abortWhileSlowToolRuns(harness);
    const callsBeforeResume = harness.modelCalls();
    const resumeStart = events.length;

    await withTimeout(
      session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: 'the first' }),
      5000,
    );

    await vi.waitFor(() =>
      expect(events.slice(resumeStart).some(e => e.type === 'agent_end' && e.reason === 'complete')).toBe(true),
    );
    const resumed = events.slice(resumeStart);
    expect(resumed.some(e => e.type === 'agent_start')).toBe(true);
    expect(resumed.some(e => e.type === 'tool_end' && e.toolCallId === 'ask-1')).toBe(true);
    expect(resumed.some(e => e.type === 'error')).toBe(false);
    expect(harness.modelCalls()).toBeGreaterThan(callsBeforeResume);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given an aborted run that is not resumed, When a new message is sent, Then only the new run streams', async () => {
    const harness = await createHarness('abort-new-message', [slowAndAskStream, () => textStream('fresh')]);
    const { session, events } = harness;
    await abortWhileSlowToolRuns(harness);
    const nextStart = events.length;

    await session.sendMessage({ content: 'something else' });

    const next = events.slice(nextStart);
    expect(next.filter(e => e.type === 'agent_start')).toHaveLength(1);
    expect(next.filter(e => e.type === 'agent_end')).toEqual([{ type: 'agent_end', reason: 'complete' }]);
    expect(next.some(e => e.type === 'tool_end' && e.toolCallId === 'ask-1')).toBe(false);
    expect(session.run.isRunning()).toBe(false);
  });

  it('Given a resume that fails to dispatch, When it fails, Then the aborted run stays filtered and a retry still completes', async () => {
    const harness = await createHarness('abort-resume-fails', [slowAndAskStream, () => textStream('thanks')]);
    const { session, agent, events } = harness;
    const markAbortedRun = vi.spyOn(session.stream, 'markAbortedRun');
    const parked = await abortWhileSlowToolRuns(harness);
    const subscription = markAbortedRun.mock.calls.find(([arg]) => arg.runId === parked.runId)![0].subscription;
    expect(session.stream.abortedRunId({ subscription })).toBe(parked.runId);

    const sendStreamResume = vi.spyOn(agent, 'sendStreamResume').mockRejectedValueOnce(new Error('dispatch failed'));
    await session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: 'the first' });
    expect(sendStreamResume).toHaveBeenCalledTimes(1);
    expect(events.some(e => e.type === 'error' && e.error.message === 'dispatch failed')).toBe(true);
    expect(session.stream.abortedRunId({ subscription })).toBe(parked.runId);
    expect(session.suspensions.has({ toolCallId: parked.toolCallId })).toBe(true);

    sendStreamResume.mockRestore();
    const resumeStart = events.length;
    await withTimeout(
      session.respondToToolSuspension({ toolCallId: parked.toolCallId, resumeData: 'the first' }),
      5000,
    );
    await vi.waitFor(() =>
      expect(events.slice(resumeStart).some(e => e.type === 'agent_end' && e.reason === 'complete')).toBe(true),
    );
    expect(session.run.isRunning()).toBe(false);
  });
});
