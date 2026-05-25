/**
 * Tests for harness tool suspension, resumption, and direct-resume abort cleanup.
 *
 * Covers the normal suspend/resume path plus abort, stale-run, and follow-up
 * cleanup behavior around direct resume streams.
 */
import { describe, it, expect, vi } from 'vitest';
import z from 'zod';
import { Agent } from '../../agent';
import { createSignal } from '../../agent/signals';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { MastraLanguageModelV2Mock } from '../../test-utils/llm-mock';
import { createTool } from '../../tools';

import { Harness } from '../harness';

vi.setConfig({ testTimeout: 30_000 });

function createToolCallStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-0',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({
        type: 'tool-call',
        toolCallId: 'call-1',
        toolName: 'confirmAction',
        input: '{"action":"deploy"}',
        providerExecuted: false,
      });
      controller.enqueue({
        type: 'finish',
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function createTextStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'stream-start', warnings: [] });
      controller.enqueue({
        type: 'response-metadata',
        id: 'id-1',
        modelId: 'mock',
        timestamp: new Date(0),
      });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', delta: 'Deployed successfully.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      });
      controller.close();
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(res => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error('waitFor: predicate never became true');
}

async function waitForWithTimers(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error('waitForWithTimers: predicate never became true');
}

async function settleWithinTicks<T>(
  promise: Promise<T>,
  ticks = 10,
): Promise<{ settled: true; value: T } | { settled: false }> {
  return Promise.race([
    promise.then(value => ({ settled: true as const, value })),
    (async () => {
      for (let i = 0; i < ticks; i++) {
        await Promise.resolve();
      }
      return { settled: false as const };
    })(),
  ]);
}

describe('Harness: tool suspension and resumption', () => {
  it('should emit a suspension-related event when a tool calls suspend(), not silently complete', async () => {
    // Tool that suspends mid-execution waiting for external input
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action, reason: 'Needs user confirmation' });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();

    // Register agent with Mastra so snapshots are persisted (needed for resumeStream)
    const mastra = new Mastra({
      agents: { 'test-agent': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent');

    const harness = new Harness({
      id: 'test-harness',
      storage,
      modes: [
        {
          id: 'default',
          name: 'Default',
          default: true,
          agent: registeredAgent,
        },
      ],
      // yolo=true so tool approval is auto-allowed → tool actually executes → suspend() is called
      initialState: { yolo: true } as any,
    });

    await harness.init();

    // Collect all events
    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();

    // Send a message — the tool should execute and call suspend()
    await harness.sendMessage({ content: 'Deploy to production' });

    // agent_end should fire with reason 'suspended', not 'complete'
    const agentEndEvent = events.find((e: any) => e.type === 'agent_end');
    expect(agentEndEvent?.reason).toBe('suspended');

    // A tool_suspended event should have been emitted with correct details
    const suspensionEvent = events.find((e: any) => e.type === 'tool_suspended');
    expect(suspensionEvent).toBeDefined();
    expect(suspensionEvent.toolName).toBe('confirmAction');
    expect(suspensionEvent.toolCallId).toBeDefined();
    expect(suspensionEvent.suspendPayload).toEqual({
      action: 'deploy',
      reason: 'Needs user confirmation',
    });
  });

  it('should set pendingSuspension display state when tool suspends', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-ds',
      name: 'Test Agent DS',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-ds': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-ds');

    const harness = new Harness({
      id: 'test-harness-ds',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    await harness.createThread();
    await harness.sendMessage({ content: 'Do it' });

    const ds = harness.getDisplayState();
    expect(ds.pendingSuspension).not.toBeNull();
    expect(ds.pendingSuspension!.toolName).toBe('confirmAction');
    expect(ds.pendingSuspension!.suspendPayload).toEqual({ action: 'deploy' });
  });

  it('should resume execution via respondToToolSuspension()', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        // Resume-aware pattern: if resumeData is present, we've already suspended once,
        // so continue instead of suspending again.
        const resumeData = context?.agent?.resumeData ?? context?.workflow?.resumeData ?? context?.resumeData;
        if (resumeData) {
          return { result: `Action "${input.action}" confirmed`, resumed: resumeData };
        }
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume',
      name: 'Test Agent Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-resume');

    const harness = new Harness({
      id: 'test-harness-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();

    // First message triggers suspension
    await harness.sendMessage({ content: 'Deploy to production' });

    const suspendEnd = events.find((e: any) => e.type === 'agent_end');
    expect(suspendEnd?.reason).toBe('suspended');

    // Clear events for resume phase
    events.length = 0;

    // Resume with data
    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    // Should emit agent_start + agent_end(complete) for the resumed run
    const resumeStart = events.find((e: any) => e.type === 'agent_start');
    expect(resumeStart).toBeDefined();

    const resumeEnd = events.find((e: any) => e.type === 'agent_end');
    expect(resumeEnd).toBeDefined();
    expect(resumeEnd.reason).toBe('complete');
    expect(events.some((e: any) => e.type === 'error')).toBe(false);

    // pendingSuspension should be cleared after resume
    const ds = harness.getDisplayState();
    expect(ds.pendingSuspension).toBeNull();
  });

  it('emits one aborted agent_end when aborting a direct resume stream', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-abort',
      name: 'Test Agent Resume Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-abort');

    const harness = new Harness({
      id: 'test-harness-resume-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const hold = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: 'resume-run-abort' };
        await hold.promise;
        yield { type: 'finish', runId: 'resume-run-abort', payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() === 'resume-run-abort');

    let subscribedRunId: string | null = 'resume-run-abort';
    (harness as any).agentThreadSubscription = {
      activeRunId: () => subscribedRunId,
      abort: () => true,
      unsubscribe: vi.fn(),
      stream: (async function* () {})(),
    };

    harness.abort();
    harness.abort();
    subscribedRunId = null;

    await waitFor(() => events.some((event: any) => event.type === 'agent_end' && event.reason === 'aborted'));
    expect(harness.getCurrentRunId()).toBeNull();

    hold.resolve();
    await resume;

    const agentEnds = events.filter((event: any) => event.type === 'agent_end');
    expect(agentEnds).toEqual([expect.objectContaining({ type: 'agent_end', reason: 'aborted' })]);
  });

  it('classifies direct resume aborts before the first stream chunk as aborted', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-prechunk-abort',
      name: 'Test Agent Resume Prechunk Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-prechunk-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-prechunk-abort');

    const harness = new Harness({
      id: 'test-harness-resume-prechunk-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const admit = deferred();
    const hold = deferred();
    let resumedRunId: string | null = null;
    vi.spyOn(registeredAgent, 'resumeStream').mockImplementation(async () => {
      await admit.promise;
      return {
        fullStream: (async function* () {
          await hold.promise;
          yield { type: 'start', runId: resumedRunId };
          yield { type: 'finish', runId: resumedRunId, payload: { stepResult: { reason: 'stop' } } };
        })(),
      } as any;
    });

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();
    resumedRunId = suspendedRunId;

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() === suspendedRunId);

    harness.abort();

    await waitFor(() => events.some((event: any) => event.type === 'agent_end' && event.reason === 'aborted'));
    expect(harness.getCurrentRunId()).toBeNull();

    admit.resolve();
    hold.resolve();
    await resume;

    expect(events.some((event: any) => event.type === 'agent_start' || event.type === 'message_end')).toBe(false);
    expect((harness as any).agentThreadSubscription).not.toBeNull();
    const agentEnds = events.filter((event: any) => event.type === 'agent_end');
    expect(agentEnds).toEqual([expect.objectContaining({ type: 'agent_end', reason: 'aborted' })]);
  });

  it('closes a partial direct resume message when the resume is aborted', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-partial-abort',
      name: 'Test Agent Resume Partial Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-partial-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-partial-abort');

    const harness = new Harness({
      id: 'test-harness-resume-partial-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const hold = deferred();
    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        yield { type: 'text-start', runId: suspendedRunId, payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: suspendedRunId, payload: { id: 'text-1', text: 'Partial output' } };
        await hold.promise;
        yield { type: 'finish', runId: suspendedRunId, payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => events.some((event: any) => event.type === 'message_update'));

    harness.abort();
    await waitFor(() => events.some((event: any) => event.type === 'agent_end' && event.reason === 'aborted'));

    (harness as any).pendingSuspensionRunId = 'newer-suspension-run';
    (harness as any).pendingSuspensionToolCallId = 'newer-tool-call';
    hold.resolve();
    await resume;

    expect(events.find((event: any) => event.type === 'message_end')).toMatchObject({
      message: expect.objectContaining({
        content: [expect.objectContaining({ type: 'text', text: 'Partial output' })],
      }),
    });
    const agentEnds = events.filter((event: any) => event.type === 'agent_end');
    expect(agentEnds).toEqual([expect.objectContaining({ type: 'agent_end', reason: 'aborted' })]);
    expect(events.findIndex((event: any) => event.type === 'message_end')).toBeLessThan(
      events.findIndex((event: any) => event.type === 'agent_end'),
    );
    expect((harness as any).pendingSuspensionRunId).toBe('newer-suspension-run');
    expect((harness as any).pendingSuspensionToolCallId).toBe('newer-tool-call');
  });

  it('does not double-close a direct resume message when a message_update listener aborts', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-listener-abort',
      name: 'Test Agent Resume Listener Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-listener-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-listener-abort');

    const harness = new Harness({
      id: 'test-harness-resume-listener-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    let abortOnUpdate = false;
    harness.subscribe(event => {
      events.push(event);
      if (abortOnUpdate && event.type === 'message_update') {
        harness.abort();
      }
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;
    abortOnUpdate = true;

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        yield { type: 'text-start', runId: suspendedRunId, payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: suspendedRunId, payload: { id: 'text-1', text: 'Partial output' } };
        yield { type: 'finish', runId: suspendedRunId, payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.filter((event: any) => event.type === 'message_end')).toHaveLength(1);
    expect(events.filter((event: any) => event.type === 'agent_end')).toEqual([
      expect.objectContaining({ reason: 'aborted' }),
    ]);
  });

  it('does not double-close a direct resume message when a message_end listener aborts', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-end-listener-abort',
      name: 'Test Agent Resume End Listener Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-end-listener-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-end-listener-abort');

    const harness = new Harness({
      id: 'test-harness-resume-end-listener-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    let abortOnEnd = false;
    harness.subscribe(event => {
      events.push(event);
      if (abortOnEnd && event.type === 'message_end') {
        harness.abort();
      }
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;
    abortOnEnd = true;

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        yield { type: 'text-start', runId: suspendedRunId, payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: suspendedRunId, payload: { id: 'text-1', text: 'Partial output' } };
        yield { type: 'finish', runId: suspendedRunId, payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.filter((event: any) => event.type === 'message_end')).toHaveLength(1);
    expect(events.filter((event: any) => event.type === 'agent_end')).toEqual([
      expect.objectContaining({ reason: 'aborted' }),
    ]);
  });

  it('preserves a same-run suspension emitted while resuming a tool', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-resuspends',
      name: 'Test Agent Resume Resuspends',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-resuspends': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-resuspends');

    const harness = new Harness({
      id: 'test-harness-resume-resuspends',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    const suspendedRunId = (harness as any).pendingSuspensionRunId;

    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        yield {
          type: 'tool-call-suspended',
          runId: suspendedRunId,
          payload: {
            toolCallId: 'call-2',
            toolName: 'confirmAction',
            args: { action: 'deploy again' },
            suspendPayload: { action: 'deploy again' },
          },
        };
      })(),
    } as any);

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect((harness as any).pendingSuspensionRunId).toBe(suspendedRunId);
    expect((harness as any).pendingSuspensionToolCallId).toBe('call-2');
    expect(harness.getDisplayState().pendingSuspension).toMatchObject({ toolCallId: 'call-2' });
  });

  it('does not miss a direct resume abort when the first stream chunk retargets the run id', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-retargeted-abort',
      name: 'Test Agent Resume Retargeted Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-retargeted-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-retargeted-abort');

    const harness = new Harness({
      id: 'test-harness-resume-retargeted-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const hold = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        await hold.promise;
        yield { type: 'start', runId: 'retargeted-resume-run' };
        yield { type: 'text-start', runId: 'retargeted-resume-run', payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: 'retargeted-resume-run', payload: { id: 'text-1', text: 'Too late' } };
        yield { type: 'finish', runId: 'retargeted-resume-run', payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => events.some((event: any) => event.type === 'agent_start'));

    harness.abort();
    await waitFor(() => events.some((event: any) => event.type === 'agent_end' && event.reason === 'aborted'));

    hold.resolve();
    await resume;

    expect(events.some((event: any) => event.type === 'message_update')).toBe(false);
    const agentEnds = events.filter((event: any) => event.type === 'agent_end');
    expect(agentEnds).toEqual([expect.objectContaining({ type: 'agent_end', reason: 'aborted' })]);
  });

  it('aborts a direct resume stream after the stream retargets the run id', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-retargeted-active-abort',
      name: 'Test Agent Resume Retargeted Active Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-retargeted-active-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-retargeted-active-abort');

    const harness = new Harness({
      id: 'test-harness-resume-retargeted-active-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const hold = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: 'retargeted-active-run' };
        await hold.promise;
        yield { type: 'text-start', runId: 'retargeted-active-run', payload: { id: 'text-1' } };
        yield { type: 'text-delta', runId: 'retargeted-active-run', payload: { id: 'text-1', text: 'Too late' } };
        yield { type: 'finish', runId: 'retargeted-active-run', payload: { stepResult: { reason: 'stop' } } };
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() === 'retargeted-active-run');

    harness.abort();
    await waitFor(() => events.some((event: any) => event.type === 'agent_end' && event.reason === 'aborted'));

    hold.resolve();
    await resume;

    expect(events.some((event: any) => event.type === 'message_update')).toBe(false);
    const agentEnds = events.filter((event: any) => event.type === 'agent_end');
    expect(agentEnds).toEqual([expect.objectContaining({ type: 'agent_end', reason: 'aborted' })]);
    expect(harness.getCurrentRunId()).toBeNull();
  });

  it('drains queued follow-ups after a direct resume abort without waiting for the stream to finish', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-abort-followup',
      name: 'Test Agent Resume Abort Follow Up',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-abort-followup': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-abort-followup');

    const harness = new Harness({
      id: 'test-harness-resume-abort-followup',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();

    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        await new Promise(() => {});
      })(),
    } as any);
    const sendSignalSpy = vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'follow-up-run',
      signal: {} as any,
    });
    let activeRunId: string | null = suspendedRunId;
    const subscribeSpy = vi.spyOn(registeredAgent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})() as any,
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => activeRunId,
    });

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() !== null);

    await harness.followUp({ content: 'continue after abort' });
    expect(harness.getFollowUpCount()).toBe(1);

    harness.abort();

    await waitFor(() => subscribeSpy.mock.calls.length > 0);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendSignalSpy).not.toHaveBeenCalled();

    activeRunId = null;
    await waitForWithTimers(() => sendSignalSpy.mock.calls.length === 1);
    expect(harness.getFollowUpCount()).toBe(0);
    await resume;
    expect((harness as any).resumingSuspensionRunIds.size).toBe(0);
    expect((harness as any).directStreamRunIds.size).toBe(0);
    expect((harness as any).abortFinalizedRunIds.size).toBe(0);
  });

  it('releases a runtime direct resume run before draining queued follow-ups when the subscription has no active run id', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-abort-followup-null-active',
      name: 'Test Agent Resume Abort Follow Up Null Active',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-abort-followup-null-active': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-abort-followup-null-active');

    const harness = new Harness({
      id: 'test-harness-resume-abort-followup-null-active',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();

    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        await new Promise(() => {});
      })(),
    } as any);
    const abortRunStreamSpy = vi.spyOn(registeredAgent, 'abortRunStream').mockReturnValue(true);
    const sendSignalSpy = vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'follow-up-run',
      signal: {} as any,
    });
    vi.spyOn(registeredAgent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})() as any,
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => null,
    });

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() !== null);

    await harness.followUp({ content: 'continue after abort' });
    harness.abort();

    await waitFor(() => sendSignalSpy.mock.calls.length === 1);
    expect(abortRunStreamSpy).toHaveBeenCalledWith(suspendedRunId);
    expect(abortRunStreamSpy.mock.invocationCallOrder[0]).toBeLessThan(sendSignalSpy.mock.invocationCallOrder[0]!);
    expect(sendSignalSpy.mock.calls[0]?.[1]).toMatchObject({ ifIdle: expect.any(Object) });

    await resume;
    expect((harness as any).resumingSuspensionRunIds.size).toBe(0);
    expect((harness as any).directStreamRunIds.size).toBe(0);
    expect((harness as any).abortFinalizedRunIds.size).toBe(0);
  });

  it('settles a direct resume abort when resumeStream has not returned yet', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-pending-abort',
      name: 'Test Agent Resume Pending Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-pending-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-pending-abort');

    const harness = new Harness({
      id: 'test-harness-resume-pending-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    vi.spyOn(registeredAgent, 'resumeStream').mockReturnValue(new Promise(() => {}) as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() !== null);

    harness.abort();
    await resume;

    expect((harness as any).resumingSuspensionRunIds.size).toBe(0);
    expect((harness as any).directStreamRunIds.size).toBe(0);
    expect((harness as any).abortFinalizedRunIds.size).toBe(0);
  });

  it('settles a direct resume abort before resumeStream is called', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-context-abort',
      name: 'Test Agent Resume Context Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-context-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-context-abort');

    const harness = new Harness({
      id: 'test-harness-resume-context-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    const contextStarted = deferred();
    vi.spyOn(harness as any, 'buildRequestContext').mockImplementation(async () => {
      contextStarted.resolve();
      await new Promise(() => {});
      return {} as any;
    });
    const resumeStreamSpy = vi.spyOn(registeredAgent, 'resumeStream');

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await contextStarted.promise;

    harness.abort();
    await resume;

    expect(resumeStreamSpy).not.toHaveBeenCalled();
    expect((harness as any).resumingSuspensionRunIds.size).toBe(0);
    expect((harness as any).directStreamRunIds.size).toBe(0);
    expect((harness as any).abortFinalizedRunIds.size).toBe(0);
  });

  it('settles a direct resume abort while waiting for tool approval', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-approval-abort',
      name: 'Test Agent Resume Approval Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-approval-abort': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-approval-abort');

    const harness = new Harness({
      id: 'test-harness-resume-approval-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => events.push(event));

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    await harness.setState({ yolo: false } as any);
    events.length = 0;

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        yield {
          type: 'tool-call-approval',
          runId: suspendedRunId,
          payload: {
            toolCallId: 'approval-call',
            toolName: 'confirmAction',
            args: { action: 'deploy' },
          },
        };
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => (harness as any).pendingApprovalResolve !== null);

    harness.abort();
    await resume;

    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_approval_required' }));
    expect(events.filter((event: any) => event.type === 'agent_end')).toEqual([
      expect.objectContaining({ reason: 'aborted' }),
    ]);
    expect((harness as any).pendingApprovalResolve).toBeNull();
    expect((harness as any).directStreamRunIds.size).toBe(0);
    expect((harness as any).abortFinalizedRunIds.size).toBe(0);
  });

  it('settles a subscribed run abort while waiting for tool approval', async () => {
    const agent = new Agent({
      id: 'test-agent-subscribed-approval-abort',
      name: 'Test Agent Subscribed Approval Abort',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock(),
    });
    const storage = new InMemoryStore();
    const harness = new Harness({
      id: 'test-harness-subscribed-approval-abort',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: false } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => events.push(event));

    let activeRunId: string | null = 'run-approval';
    const unsubscribe = vi.fn(() => {
      activeRunId = null;
    });
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {
        yield { type: 'start', runId: 'run-approval', payload: {} };
        yield {
          type: 'tool-call-approval',
          runId: 'run-approval',
          payload: {
            toolCallId: 'approval-call',
            toolName: 'confirmAction',
            args: { action: 'deploy' },
          },
        };
      })() as any,
      unsubscribe,
      abort: vi.fn(),
      activeRunId: () => activeRunId,
    });
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'run-approval',
      signal: createSignal({ type: 'user-message', contents: 'Deploy to production' }),
    });
    const declineToolCall = vi.spyOn(agent, 'declineToolCall');

    await harness.createThread();
    const signal = harness.sendSignal({ content: 'Deploy to production' });
    await signal.accepted;
    await waitFor(() => (harness as any).pendingApprovalResolve !== null);

    harness.abort();

    await waitFor(
      () =>
        events.some(event => event.type === 'agent_end' && event.reason === 'aborted') &&
        (harness as any).pendingApprovalResolve === null,
    );

    expect(events).toContainEqual(expect.objectContaining({ type: 'tool_approval_required' }));
    expect(events.filter((event: any) => event.type === 'agent_end')).toEqual([
      expect.objectContaining({ reason: 'aborted' }),
    ]);
    expect(declineToolCall).not.toHaveBeenCalled();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('does not route a stale approval decision into a newer active run', async () => {
    const agent = new Agent({
      id: 'test-agent-stale-approval',
      name: 'Test Agent Stale Approval',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock(),
    });
    const storage = new InMemoryStore();
    const harness = new Harness({
      id: 'test-harness-stale-approval',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: false } as any,
    });
    await harness.init();

    const holdStream = deferred();
    vi.spyOn(agent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {
        yield { type: 'start', runId: 'stale-run', payload: {} };
        yield {
          type: 'tool-call-approval',
          runId: 'stale-run',
          payload: {
            toolCallId: 'approval-call',
            toolName: 'confirmAction',
            args: { action: 'deploy' },
          },
        };
        await holdStream.promise;
      })() as any,
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => 'newer-run',
    });
    vi.spyOn(agent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'stale-run',
      signal: createSignal({ type: 'user-message', contents: 'Deploy to production' }),
    });
    const approveToolCall = vi.spyOn(agent, 'approveToolCall');
    const declineToolCall = vi.spyOn(agent, 'declineToolCall');

    await harness.createThread();
    const signal = harness.sendSignal({ content: 'Deploy to production' });
    await signal.accepted;
    await waitFor(() => (harness as any).pendingApprovalResolve !== null);

    (harness as any).currentRunId = 'newer-run';
    harness.respondToToolApproval({ decision: 'decline' });
    await Promise.resolve();

    expect(approveToolCall).not.toHaveBeenCalled();
    expect(declineToolCall).not.toHaveBeenCalled();
    expect(harness.getCurrentRunId()).toBe('newer-run');

    holdStream.resolve();
  });

  it('drains multiple queued follow-ups after a direct resume abort', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-abort-serial-followup',
      name: 'Test Agent Resume Abort Serial Follow Up',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-abort-serial-followup': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-abort-serial-followup');

    const harness = new Harness({
      id: 'test-harness-resume-abort-serial-followup',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        await new Promise(() => {});
      })(),
    } as any);
    const sendSignalSpy = vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'first-follow-up-run',
      signal: {} as any,
    });

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() !== null);

    await harness.followUp({ content: 'first follow-up' });
    await harness.followUp({ content: 'second follow-up' });
    expect(harness.getFollowUpCount()).toBe(2);

    harness.abort();

    await waitFor(() => sendSignalSpy.mock.calls.length === 1);
    await resume;

    expect(sendSignalSpy).toHaveBeenCalledTimes(2);
    expect(harness.getFollowUpCount()).toBe(0);
  });

  it('reschedules queued follow-up draining after a reentrant drain call', async () => {
    const agent = new Agent({
      id: 'test-agent-reentrant-followup-drain',
      name: 'Test Agent Reentrant Follow Up Drain',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const storage = new InMemoryStore();
    const harness = new Harness({
      id: 'test-harness-reentrant-followup-drain',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
    });
    const sent: string[] = [];
    vi.spyOn(harness as any, 'sendMessage').mockImplementation(async ({ content }: { content: string }) => {
      sent.push(content);
      await (harness as any).drainFollowUpQueue();
    });
    (harness as any).followUpQueue = [{ content: 'first' }, { content: 'second' }];

    await (harness as any).drainFollowUpQueue();
    await waitFor(() => sent.length === 2);

    expect(sent).toEqual(['first', 'second']);
    expect(harness.getFollowUpCount()).toBe(0);
  });

  it('finalizes a subscribed run as subscribed when activeRunId is temporarily null', () => {
    const agent = new Agent({
      id: 'test-agent-subscribed-null-active',
      name: 'Test Agent Subscribed Null Active',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createTextStream() }),
      }),
    });
    const storage = new InMemoryStore();
    const harness = new Harness({
      id: 'test-harness-subscribed-null-active',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent }],
      initialState: { yolo: true } as any,
    });
    const events: any[] = [];
    harness.subscribe(event => events.push(event));

    (harness as any).currentRunId = 'subscribed-run';
    (harness as any).abortController = new AbortController();
    (harness as any).agentThreadSubscription = {
      activeRunId: () => null,
      abort: vi.fn(),
      unsubscribe: vi.fn(),
      stream: (async function* () {})(),
    };

    harness.abort();

    expect(events).toContainEqual(expect.objectContaining({ type: 'agent_end', reason: 'aborted' }));
    expect((harness as any).abortFinalizedRunIds.has('subscribed-run')).toBe(false);
  });

  it('cleans retargeted direct resume state when the stream throws', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-resume-retargeted-error',
      name: 'Test Agent Resume Retargeted Error',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-resume-retargeted-error': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-resume-retargeted-error');

    const harness = new Harness({
      id: 'test-harness-resume-retargeted-error',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    events.length = 0;

    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: 'retargeted-error-run' };
        throw new Error('retargeted stream failed');
      })(),
    } as any);

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(events.find((event: any) => event.type === 'error')).toBeDefined();
    expect(events.find((event: any) => event.type === 'agent_end')).toMatchObject({ reason: 'error' });
    expect(harness.getCurrentRunId()).toBeNull();
    expect((harness as any).directStreamRunIds.has(suspendedRunId)).toBe(false);
    expect((harness as any).directStreamRunIds.has('retargeted-error-run')).toBe(false);
  });

  it('does not let a stale suspension resume detach a newer active run', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-stale-resume',
      name: 'Test Agent Stale Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-stale-resume': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-stale-resume');

    const harness = new Harness({
      id: 'test-harness-stale-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const resumeStreamSpy = vi.spyOn(registeredAgent, 'resumeStream');
    const unsubscribe = vi.fn();
    (harness as any).currentRunId = 'newer-run';
    (harness as any).abortController = new AbortController();
    (harness as any).agentThreadSubscription = {
      activeRunId: () => 'newer-run',
      abort: vi.fn(),
      unsubscribe,
      stream: (async function* () {})(),
    };

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(resumeStreamSpy).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
    expect(harness.getCurrentRunId()).toBe('newer-run');
    expect(events.some((event: any) => event.type === 'error')).toBe(true);
    expect(events.some((event: any) => event.type === 'agent_end')).toBe(false);
  });

  it('does not admit duplicate responses while a suspension resume is in flight', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-duplicate-resume',
      name: 'Test Agent Duplicate Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-duplicate-resume': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-duplicate-resume');

    const harness = new Harness({
      id: 'test-harness-duplicate-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();

    const events: any[] = [];
    harness.subscribe(event => {
      events.push(event);
    });

    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });
    events.length = 0;

    const resumeStarted = deferred();
    const hold = deferred();
    const resumeStreamSpy = vi.spyOn(registeredAgent, 'resumeStream').mockImplementation(async () => {
      resumeStarted.resolve();
      return {
        fullStream: (async function* () {
          await hold.promise;
          yield { type: 'start', runId: (harness as any).pendingSuspensionRunId };
          yield {
            type: 'finish',
            runId: (harness as any).pendingSuspensionRunId,
            payload: { stepResult: { reason: 'stop' } },
          };
        })(),
      } as any;
    });

    const first = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await resumeStarted.promise;
    await waitFor(() => harness.getCurrentRunId() !== null);

    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(resumeStreamSpy).toHaveBeenCalledTimes(1);
    expect(events.some((event: any) => event.type === 'error')).toBe(true);

    hold.resolve();
    await first;
  });

  it('does not let a concurrent signal detach an active direct resume stream', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-concurrent-direct-resume',
      name: 'Test Agent Concurrent Direct Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-concurrent-direct-resume': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-concurrent-direct-resume');

    const harness = new Harness({
      id: 'test-harness-concurrent-direct-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();
    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();

    const resumeStarted = deferred();
    const admit = deferred();
    const hold = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockImplementation(async () => {
      resumeStarted.resolve();
      await admit.promise;
      return {
        fullStream: (async function* () {
          await hold.promise;
          yield { type: 'start', runId: suspendedRunId };
          yield { type: 'finish', runId: suspendedRunId, payload: { stepResult: { reason: 'stop' } } };
        })(),
      } as any;
    });

    const registered = deferred();
    const waitForRunOutputSpy = vi.spyOn(registeredAgent, 'waitForRunOutput').mockImplementation(async () => {
      await registered.promise;
      return { status: 'running' } as any;
    });
    const sendSignalSpy = vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: suspendedRunId,
      signal: {} as any,
    });

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await resumeStarted.promise;
    await waitFor(() => harness.getCurrentRunId() === suspendedRunId);

    const signal = harness.sendSignal({ content: 'still there?' });
    await Promise.resolve();

    expect(waitForRunOutputSpy).toHaveBeenCalledWith(suspendedRunId, expect.any(Object));
    expect(sendSignalSpy).not.toHaveBeenCalled();
    expect(harness.getCurrentRunId()).toBe(suspendedRunId);
    expect((harness as any).directStreamRunIds.has(suspendedRunId)).toBe(true);

    admit.resolve();
    registered.resolve();
    await expect(signal.accepted).resolves.toMatchObject({ accepted: true, runId: suspendedRunId });

    expect(sendSignalSpy).toHaveBeenCalledTimes(1);
    expect(sendSignalSpy.mock.calls[0]?.[1]).toMatchObject({ runId: suspendedRunId });
    expect((harness as any).directStreamRunIds.has(suspendedRunId)).toBe(true);

    hold.resolve();
    await resume;
    expect(harness.getCurrentRunId()).toBeNull();
  });

  it('does not wait for direct resume completion after a user message is admitted', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-direct-resume-send-message',
      name: 'Test Agent Direct Resume Send Message',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-direct-resume-send-message': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-direct-resume-send-message');

    const harness = new Harness({
      id: 'test-harness-direct-resume-send-message',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();
    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();

    const resumeStarted = deferred();
    const admit = deferred();
    const hold = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockImplementation(async () => {
      resumeStarted.resolve();
      await admit.promise;
      return {
        fullStream: (async function* () {
          await hold.promise;
          yield { type: 'start', runId: suspendedRunId };
          yield { type: 'finish', runId: suspendedRunId, payload: { stepResult: { reason: 'stop' } } };
        })(),
      } as any;
    });

    const registered = deferred();
    vi.spyOn(registeredAgent, 'waitForRunOutput').mockImplementation(async () => {
      await registered.promise;
      return { status: 'running' } as any;
    });
    vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: suspendedRunId,
      signal: {} as any,
    });

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await resumeStarted.promise;
    await waitFor(() => harness.getCurrentRunId() === suspendedRunId);

    const message = harness.sendMessage({ content: 'still there?' });
    await Promise.resolve();
    expect(await settleWithinTicks(message)).toEqual({ settled: false });

    registered.resolve();
    await expect(message).resolves.toBeUndefined();

    admit.resolve();
    hold.resolve();
    await resume;
  });

  it('does not attach a fresh signal to a direct resume run that is still shutting down after abort', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-aborted-direct-resume-admission',
      name: 'Test Agent Aborted Direct Resume Admission',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: async () => ({ stream: createToolCallStream() }),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-aborted-direct-resume-admission': agent },
      logger: false,
      storage,
    });
    const registeredAgent = mastra.getAgent('test-agent-aborted-direct-resume-admission');

    const harness = new Harness({
      id: 'test-harness-aborted-direct-resume-admission',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });
    await harness.init();
    await harness.createThread();
    await harness.sendMessage({ content: 'Deploy to production' });

    const suspendedRunId = (harness as any).pendingSuspensionRunId;
    expect(suspendedRunId).toBeTruthy();

    const holdResume = deferred();
    vi.spyOn(registeredAgent, 'resumeStream').mockResolvedValue({
      fullStream: (async function* () {
        yield { type: 'start', runId: suspendedRunId };
        await holdResume.promise;
      })(),
    } as any);

    const resume = harness.respondToToolSuspension({ resumeData: { confirmed: true } });
    await waitFor(() => harness.getCurrentRunId() === suspendedRunId);

    harness.abort();

    let activeRunId: string | null = suspendedRunId;
    vi.spyOn(registeredAgent, 'subscribeToThread').mockResolvedValue({
      stream: (async function* () {})() as any,
      unsubscribe: vi.fn(),
      abort: vi.fn(),
      activeRunId: () => activeRunId,
    });
    const sendSignalSpy = vi.spyOn(registeredAgent, 'sendSignal').mockReturnValue({
      accepted: true,
      runId: 'fresh-run',
      signal: createSignal({ type: 'user-message', contents: 'fresh work' }),
    });

    const signal = harness.sendSignal({ content: 'fresh work' });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(sendSignalSpy).not.toHaveBeenCalled();

    activeRunId = null;
    await expect(signal.accepted).resolves.toMatchObject({ accepted: true, runId: 'fresh-run' });
    expect(sendSignalSpy).toHaveBeenCalledTimes(1);
    expect(sendSignalSpy.mock.calls[0]?.[1]).toMatchObject({ ifIdle: expect.any(Object) });
    expect(sendSignalSpy.mock.calls[0]?.[1]).not.toHaveProperty('runId');

    holdResume.resolve();
    await resume;
  });

  it('should forward requireToolApproval=false to resumeStream when harness is in yolo mode', async () => {
    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Confirms an action with the user',
      inputSchema: z.object({ action: z.string() }),
      execute: async (input: { action: string }, context?: any) => {
        const suspend = context?.suspend ?? context?.agent?.suspend;
        if (!suspend) throw new Error('suspend not available in context');
        await suspend({ action: input.action });
        return { result: `Action "${input.action}" confirmed` };
      },
    });

    const agent = new Agent({
      id: 'test-agent-yolo-resume',
      name: 'Test Agent Yolo Resume',
      instructions: 'You confirm actions.',
      model: new MastraLanguageModelV2Mock({
        doStream: (() => {
          let callCount = 0;
          return async () => {
            callCount++;
            return { stream: callCount === 1 ? createToolCallStream() : createTextStream() };
          };
        })(),
      }),
      tools: { confirmAction: confirmTool },
    });

    const storage = new InMemoryStore();
    const mastra = new Mastra({
      agents: { 'test-agent-yolo-resume': agent },
      logger: false,
      storage,
    });

    const registeredAgent = mastra.getAgent('test-agent-yolo-resume');

    const resumeStreamSpy = vi.spyOn(registeredAgent, 'resumeStream');

    const harness = new Harness({
      id: 'test-harness-yolo-resume',
      storage,
      modes: [{ id: 'default', name: 'Default', default: true, agent: registeredAgent }],
      initialState: { yolo: true } as any,
    });

    await harness.init();
    await harness.createThread();

    await harness.sendMessage({ content: 'Deploy to production' });
    await harness.respondToToolSuspension({ resumeData: { confirmed: true } });

    expect(resumeStreamSpy).toHaveBeenCalled();
    const [, resumeOptions] = resumeStreamSpy.mock.calls[0] as [any, any];
    // Yolo mode should disable tool approval gating on resume, matching sendMessage's behavior
    expect(resumeOptions.requireToolApproval).toBe(false);
  });
});
