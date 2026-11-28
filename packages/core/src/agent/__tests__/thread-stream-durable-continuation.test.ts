import { describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent, emitFinishEvent } from '../durable/stream-adapter';
import { startRunStep } from '../run-lease-fence';
import { AgentThreadStreamRuntime } from '../thread-stream-runtime';

function setup() {
  const runtime = new AgentThreadStreamRuntime();
  const pubsub = new EventEmitterPubSub();
  const publishOriginal = pubsub.publish.bind(pubsub);
  const publish = vi.spyOn(pubsub, 'publish');
  const agent = { id: 'continuation-agent' } as Agent<any, any, any, any>;
  const options = { memory: { thread: 'continuation-thread', resource: 'continuation-user' } };
  const runId = crypto.randomUUID();
  const makeStream = (options?: { closeOnSuspend?: boolean; runId?: string }) =>
    createDurableAgentStream({
      pubsub,
      runId: options?.runId ?? runId,
      messageId: crypto.randomUUID(),
      model: { modelId: 'mock', provider: 'mock', version: 'v3' },
      closeOnSuspend: options?.closeOnSuspend,
    });
  const chunk = (type: string, payload: Record<string, unknown>) =>
    emitChunkEvent(pubsub, runId, { type, payload, runId, from: 'AGENT' } as any);
  const finish = () =>
    emitFinishEvent(pubsub, runId, {
      output: { text: 'answer', steps: [] },
      stepResult: { reason: 'stop' },
    } as any);
  const registrations = () => publish.mock.calls.filter(([, event]) => event.type === 'run-registered');
  const suspensions = () => publish.mock.calls.filter(([, event]) => event.type === 'run-suspended');
  return {
    runtime,
    pubsub,
    publish,
    publishOriginal,
    agent,
    options,
    runId,
    makeStream,
    chunk,
    finish,
    registrations,
    suspensions,
  };
}

describe('durable thread continuation', () => {
  it('delivers every sibling suspension prompt to a remote subscriber', async () => {
    const h = setup();
    const subscriberRuntime = new AgentThreadStreamRuntime();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    const subscription = await subscriberRuntime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const reading = (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();

    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'one', args: {} });
    await h.chunk('tool-call-approval', { toolCallId: 'call-2', toolName: 'two', args: {} });

    await vi.waitFor(() =>
      expect(parts.filter(part => part.type === 'tool-call-approval').map(part => part.payload.toolCallId)).toEqual([
        'call-1',
        'call-2',
      ]),
    );
    expect(h.suspensions()).toHaveLength(2);

    subscription.unsubscribe();
    await reading;
  });

  it('keeps the continuation broadcast alive when a suspension boundary publish fails', async () => {
    const h = setup();
    let failSuspensionBoundary = true;
    h.publish.mockImplementation(async (topic, event) => {
      if (event.type === 'run-suspended' && failSuspensionBoundary) {
        failSuspensionBoundary = false;
        throw new Error('suspension boundary publish failed');
      }
      await h.publishOriginal(topic, event);
    });
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    const subscriberRuntime = new AgentThreadStreamRuntime();
    const subscription = await subscriberRuntime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const reading = (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();

    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'one', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 0));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(
      h.runtime.continueRun(h.agent, resumed.output, { ...h.options, toolCallId: 'call-1' } as any, h.pubsub),
    ).toBe(true);
    await h.chunk('text-delta', { text: 'resumed' });
    await vi.waitFor(() =>
      expect(parts.some(part => part.type === 'text-delta' && part.payload.text === 'resumed')).toBe(true),
    );

    subscription.unsubscribe();
    await reading;
  });

  it.each([false, true])('broadcasts one answer and keeps the prefix with delayed reader=%s', async delayed => {
    const h = setup();
    const initialContext = new RequestContext();
    const resumedContext = new RequestContext();
    const resumedAgainContext = new RequestContext();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, { ...h.options, requestContext: initialContext }, h.pubsub, {
      continuation: 'across-suspension',
    });
    const subscription = await h.runtime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const read = async () => {
      for await (const part of subscription.stream) parts.push(part);
    };
    let reading = delayed ? undefined : read();
    await h.chunk('text-delta', { text: 'prefix' });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));
    if (!delayed) {
      await vi.waitFor(() => expect(parts.some(part => part.type === 'tool-call-approval')).toBe(true));
      expect(subscription.__getCurrentRunRequestContext!()).toBe(initialContext);
    }
    const resumed = h.makeStream();
    await resumed.ready;
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        {
          ...h.options,
          requestContext: resumedContext,
          toolCallId: 'call-1',
        } as any,
        h.pubsub,
      ),
    ).toBe(true);
    expect(h.registrations()).toHaveLength(1);
    if (!delayed) expect(subscription.__getCurrentRunRequestContext!()).toBe(resumedContext);

    // A resumed segment is running even while the continuous output's last
    // status remains suspended. Same-agent work must still wait its turn.
    let contenderStarted = false;
    const contender = h.runtime
      .waitForCrossAgentThreadRun(h.agent, { ...h.options, runId: 'next-run' }, h.pubsub)
      .then(() => {
        contenderStarted = true;
      });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(contenderStarted).toBe(false);

    await h.chunk('tool-call-approval', { toolCallId: 'call-2', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(resumed.output.status).toBe('suspended'));
    await vi.waitFor(() => expect(h.suspensions()).toHaveLength(2));
    const resumedAgain = h.makeStream();
    await resumedAgain.ready;
    expect(
      h.runtime.continueRun(
        h.agent,
        resumedAgain.output,
        {
          ...h.options,
          requestContext: resumedAgainContext,
          toolCallId: 'call-2',
        } as any,
        h.pubsub,
      ),
    ).toBe(true);
    expect(h.registrations()).toHaveLength(1);
    if (!delayed) expect(subscription.__getCurrentRunRequestContext!()).toBe(resumedAgainContext);

    await h.chunk('text-delta', { text: 'answer' });
    await h.finish();
    // No caller reads either resumed fullStream; continuation must drain both.
    await Promise.all([resumed.output._waitUntilFinished(), resumedAgain.output._waitUntilFinished()]);
    reading ??= read();
    await vi.waitFor(() => expect(parts.some(part => part.type === 'finish')).toBe(true));
    expect(parts.filter(part => part.type === 'text-delta').map(part => part.payload.text)).toEqual([
      'prefix',
      'answer',
    ]);
    await contender;
    subscription.unsubscribe();
    await reading;
    first.cleanup();
    resumed.cleanup();
    resumedAgain.cleanup();
    await h.pubsub.close();
  });

  it('registers a replacement after the original adapter was cleaned up', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    expect(h.runtime.closeRunContinuation(first.output, h.pubsub)).toBe(true);
    first.cleanup();
    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    await h.runtime.registerRun(h.agent, resumed.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);
    const subscription = await h.runtime.subscribeToThread(
      h.agent,
      {
        threadId: h.options.memory.thread,
        resourceId: h.options.memory.resource,
      },
      h.pubsub,
    );
    const parts: any[] = [];
    const reading = (async () => {
      for await (const part of subscription.stream) parts.push(part);
    })();
    await h.chunk('text-delta', { text: 'answer' });
    await h.finish();
    await vi.waitFor(() => expect(parts.some(part => part.type === 'finish')).toBe(true));
    expect(parts.filter(part => part.type === 'text-delta')).toHaveLength(1);
    subscription.unsubscribe();
    await reading;
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('lets only the source or current segment close continuation', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(
      h.runtime.continueRun(h.agent, resumed.output, { ...h.options, toolCallId: 'call-1' } as any, h.pubsub),
    ).toBe(true);
    await h.chunk('tool-call-approval', { toolCallId: 'call-2', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(resumed.output.status).toBe('suspended'));

    const latest = h.makeStream();
    await latest.ready;
    expect(h.runtime.continueRun(h.agent, latest.output, { ...h.options, toolCallId: 'call-2' } as any, h.pubsub)).toBe(
      true,
    );
    await h.chunk('tool-call-approval', { toolCallId: 'call-3', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(latest.output.status).toBe('suspended'));

    expect(h.runtime.closeRunContinuation(resumed.output, h.pubsub)).toBe(false);
    expect(h.runtime.closeRunContinuation(latest.output, h.pubsub)).toBe(true);

    const replacement = h.makeStream();
    await replacement.ready;
    expect(h.runtime.continueRun(h.agent, replacement.output, h.options, h.pubsub)).toBe(false);
    await h.runtime.registerRun(h.agent, replacement.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);

    first.cleanup();
    resumed.cleanup();
    latest.cleanup();
    replacement.cleanup();
    await h.pubsub.close();
  });

  it('does not continue a registration that was not declared suspension-spanning', async () => {
    const h = setup();
    const first = h.makeStream({ closeOnSuspend: true });
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub);
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    await h.runtime.registerRun(h.agent, resumed.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);

    await h.finish();
    await resumed.output._waitUntilFinished();
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('rejects continuation when the local run identity does not match', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'read_page', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));

    const resumed = h.makeStream();
    await resumed.ready;
    const otherAgent = { id: h.agent.id } as Agent<any, any, any, any>;
    expect(h.runtime.continueRun(otherAgent, resumed.output, h.options, h.pubsub)).toBe(false);
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        { memory: { ...h.options.memory, thread: 'other-thread' } },
        h.pubsub,
      ),
    ).toBe(false);
    expect(
      h.runtime.continueRun(
        h.agent,
        resumed.output,
        { memory: { ...h.options.memory, resource: 'other-resource' } },
        h.pubsub,
      ),
    ).toBe(false);
    expect(h.runtime.closeRunContinuation(resumed.output, h.pubsub)).toBe(false);
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(true);

    await h.finish();
    await resumed.output._waitUntilFinished();
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('returns false when no live local broadcast exists', async () => {
    const h = setup();
    const output = h.makeStream();
    await output.ready;
    expect(h.runtime.continueRun(h.agent, output.output, h.options, h.pubsub)).toBe(false);
    output.cleanup();
    await h.pubsub.close();
  });

  it('returns false after the broadcast pump terminates', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await h.finish();
    await first.output._waitUntilFinished();

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    expect(h.registrations()).toHaveLength(1);
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('always creates a new registration when registerRun is called', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });

    const replacement = h.makeStream();
    await replacement.ready;
    await h.runtime.registerRun(h.agent, replacement.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    expect(h.registrations()).toHaveLength(2);

    await h.finish();
    await Promise.all([first.output._waitUntilFinished(), replacement.output._waitUntilFinished()]);
    first.cleanup();
    replacement.cleanup();
    await h.pubsub.close();
  });

  it('returns false after the broadcast pump errors', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    await emitErrorEvent(h.pubsub, h.runId, new Error('broadcast failed'));
    await vi.waitFor(() => expect(first.output.status).toBe('failed'));

    const resumed = h.makeStream();
    await resumed.ready;
    expect(h.runtime.continueRun(h.agent, resumed.output, h.options, h.pubsub)).toBe(false);
    first.cleanup();
    resumed.cleanup();
    await h.pubsub.close();
  });

  it('keeps strict recovery ownership validation even for a live same-run stream', async () => {
    const h = setup();
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(h.agent, first.output, h.options, h.pubsub, {
      continuation: 'across-suspension',
    });
    const recovered = h.makeStream();
    await recovered.ready;
    await expect(
      h.runtime.registerRun(h.agent, recovered.output, h.options, h.pubsub, {
        strict: true,
        continuation: 'across-suspension',
        validate: () => {
          throw new Error('Recovery ownership lost');
        },
      }),
    ).rejects.toThrow('Recovery ownership lost');
    expect(h.registrations()).toHaveLength(1);
    await h.finish();
    await first.output._waitUntilFinished();
    first.cleanup();
    recovered.cleanup();
    await h.pubsub.close();
  });
});

/**
 * Inngest's `approveToolCall({ runId, toolCallId })` resumes with options that name the run but no thread. The run
 * continues on its own thread so the answered approval is cleared, unless the resume names another resource. (#30190)
 */
describe('continuing a run from a resume that names no thread', () => {
  const threadId = 'continuation-thread';
  const resourceId = 'continuation-user';

  /** A run that continues across suspensions, parked on an approval, on an agent with auto-resume on. */
  async function parkedOnApproval() {
    const h = setup();
    const queuedTurns: any[] = [];
    const agent = {
      id: 'continuation-agent',
      getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
      // The queued turn a follow-up starts; only its options matter here.
      stream: vi.fn(async (_signal: unknown, options: any) => {
        queuedTurns.push(options);
        return { runId: options.runId };
      }),
    } as unknown as Agent<any, any, any, any>;
    const first = h.makeStream();
    await first.ready;
    await h.runtime.registerRun(
      agent,
      first.output,
      { memory: { thread: threadId, resource: resourceId, options: { lastMessages: 10, semanticRecall: false } } },
      h.pubsub,
      { continuation: 'across-suspension' },
    );
    await h.chunk('tool-call-approval', { toolCallId: 'call-1', toolName: 'approve_me', args: {} });
    await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
    await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));
    const resumed = h.makeStream();
    await resumed.ready;
    const activeRunId = () => h.runtime.getActiveThreadRunId({ threadId, resourceId }, h.pubsub);
    /** The plain tool suspends, then a follow-up arrives: it starts the queued turn unless the run is approval-parked. */
    const suspendAndSendFollowUp = async () => {
      await h.chunk('tool-call-suspended', { toolCallId: 'call-2', toolName: 'ask', suspendPayload: {} });
      await vi.waitFor(() => expect(resumed.output.status).toBe('suspended'));
      await vi.waitFor(() => expect(h.suspensions()).toHaveLength(2));
      const sent = h.runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'my answer' },
        { resourceId, threadId },
        h.pubsub,
      );
      expect((await sent.accepted).action).toBe('deliver');
    };
    const cleanup = async () => {
      first.cleanup();
      resumed.cleanup();
      await h.pubsub.close();
    };
    return { h, agent, queuedTurns, resumed, activeRunId, suspendAndSendFollowUp, cleanup };
  }

  it('continues on the run thread, clears the answered approval and keeps the run memory', async () => {
    const p = await parkedOnApproval();
    try {
      expect(
        p.h.runtime.continueRun(
          p.agent,
          p.resumed.output,
          { runId: p.h.runId, toolCallId: 'call-1' } as any,
          p.h.pubsub,
        ),
      ).toBe(true);
      expect(p.h.registrations()).toHaveLength(1);
      expect(p.h.runtime.isRunParked(p.h.runId, p.h.pubsub)).toBe(false);
      expect(p.activeRunId()).toBe(p.h.runId);

      // A run still recorded as approval-parked would keep the thread, and the follow-up would never run.
      await p.suspendAndSendFollowUp();
      await vi.waitFor(() => expect(p.queuedTurns).toHaveLength(1));
      expect(p.activeRunId()).not.toBe(p.h.runId);
      expect(p.queuedTurns[0].memory).toEqual({
        thread: threadId,
        resource: resourceId,
        options: { lastMessages: 10, semanticRecall: false },
      });
    } finally {
      await p.cleanup();
    }
  });

  it('continues on the run thread when the resume names the run resource', async () => {
    const p = await parkedOnApproval();
    try {
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
      expect(
        p.h.runtime.continueRun(
          p.agent,
          p.resumed.output,
          { runId: p.h.runId, toolCallId: 'call-1', requestContext } as any,
          p.h.pubsub,
        ),
      ).toBe(true);
      expect(p.h.runtime.isRunParked(p.h.runId, p.h.pubsub)).toBe(false);
    } finally {
      await p.cleanup();
    }
  });

  it('keeps the memory settings the resume passes itself', async () => {
    const p = await parkedOnApproval();
    try {
      expect(
        p.h.runtime.continueRun(
          p.agent,
          p.resumed.output,
          { runId: p.h.runId, toolCallId: 'call-1', memory: { options: { lastMessages: 1, readOnly: true } } } as any,
          p.h.pubsub,
        ),
      ).toBe(true);
      await p.suspendAndSendFollowUp();
      await vi.waitFor(() => expect(p.queuedTurns).toHaveLength(1));
      expect(p.queuedTurns[0].memory).toEqual({
        thread: threadId,
        resource: resourceId,
        options: { lastMessages: 1, readOnly: true, semanticRecall: false },
      });
    } finally {
      await p.cleanup();
    }
  });

  it.each([
    ['in its memory', () => ({ memory: { resource: 'other-resource' } })],
    [
      'in its request context',
      () => {
        const requestContext = new RequestContext();
        requestContext.set(MASTRA_RESOURCE_ID_KEY, 'other-resource');
        return { requestContext };
      },
    ],
  ])('does not continue a run for a resume that names another resource %s', async (_where, resumeTarget) => {
    const p = await parkedOnApproval();
    try {
      expect(
        p.h.runtime.continueRun(
          p.agent,
          p.resumed.output,
          { runId: p.h.runId, toolCallId: 'call-1', ...resumeTarget() } as any,
          p.h.pubsub,
        ),
      ).toBe(false);
      // The run keeps its thread, its approval and its memory.
      expect(p.h.runtime.isRunParked(p.h.runId, p.h.pubsub)).toBe(true);
      expect(p.activeRunId()).toBe(p.h.runId);
    } finally {
      await p.cleanup();
    }
  });

  it('returns false for a resume that names no thread and a run with no record here', async () => {
    const h = setup();
    const output = h.makeStream();
    await output.ready;
    try {
      expect(
        h.runtime.continueRun(h.agent, output.output, { runId: h.runId, toolCallId: 'call-1' } as any, h.pubsub),
      ).toBe(false);
    } finally {
      output.cleanup();
      await h.pubsub.close();
    }
  });
});

/**
 * A run parked on a tool's suspend() in one process can be resumed from another: that process registers the run and
 * executes it, while this process still holds the parked record. (#30190)
 */
describe('a follow-up sent while another runtime executes the parked run', () => {
  // Technical: the #30190 release checked only this process's record and step owners. A resume registered by another
  // runtime marks the record `registeredElsewhere`, but the record still read as parked, so a follow-up started a turn
  // here beside the remote execution. With that check alone, this process also kept its own copy of the follow-up it
  // forwarded: once the other runtime's reply turn ended, the stale parked record here was released and that copy ran
  // as a second reply turn. A follow-up sent to the executing process itself was broadcast, and this process admitted
  // that broadcast into its own queue, with the same second reply turn as the result. (#30190)
  it.each([
    { sentTo: 'the process that parked it', otherRunParks: 'before the follow-up is sent' },
    { sentTo: 'the process that parked it', otherRunParks: 'after the follow-up is sent' },
    { sentTo: 'the process executing it', otherRunParks: 'before the follow-up is sent' },
    { sentTo: 'the process executing it', otherRunParks: 'after the follow-up is sent' },
  ] as const)(
    'runs a follow-up sent to $sentTo once, on the process executing the run, when that run parks $otherRunParks, with auto-resume on (#30190)',
    async ({ sentTo, otherRunParks }) => {
      const h = setup();
      const threadId = 'continuation-thread';
      const resourceId = 'continuation-user';
      const turnStreams: Array<ReturnType<typeof h.makeStream>> = [];
      const turnInputs: string[] = [];
      /** An agent instance in one process: each queued turn it starts streams and registers on that process's runtime. */
      const agentInProcess = (runtime: AgentThreadStreamRuntime, turns: string[]) => {
        const agent = {
          id: 'continuation-agent',
          getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
          stream: vi.fn(async (input: unknown, options: { runId: string }) => {
            turnInputs.push(JSON.stringify(input));
            turns.push(options.runId);
            const turn = h.makeStream({ runId: options.runId });
            turnStreams.push(turn);
            await turn.ready;
            await runtime.registerRun(agent, turn.output, options as any, h.pubsub);
            return turn.output;
          }),
        } as unknown as Agent<any, any, any, any>;
        return agent;
      };
      const otherRuntime = new AgentThreadStreamRuntime();
      const turnsHere: string[] = [];
      const turnsElsewhere: string[] = [];
      const agent = agentInProcess(h.runtime, turnsHere);
      const otherAgent = agentInProcess(otherRuntime, turnsElsewhere);
      const first = h.makeStream();
      const resumed = h.makeStream();
      try {
        await first.ready;
        await h.runtime.registerRun(agent, first.output, h.options, h.pubsub, { continuation: 'across-suspension' });
        await vi.waitFor(() => expect(h.registrations()).toHaveLength(1));
        await h.chunk('tool-call-suspended', { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} });
        await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
        await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));

        // Another process resumes the run and executes it from here on.
        await resumed.ready;
        await otherRuntime.registerRun(
          otherAgent,
          resumed.output,
          { ...h.options, toolCallId: 'call-1' } as any,
          h.pubsub,
          { continuation: 'across-suspension' },
        );
        await vi.waitFor(() => expect(h.registrations()).toHaveLength(2));
        // The answered question leads to another: the run parks again in that process.
        const parkElsewhere = async () => {
          await h.chunk('tool-call-suspended', { toolCallId: 'call-2', toolName: 'ask', suspendPayload: {} });
          // Both runtimes read the run's stream, so each reports this suspension.
          await vi.waitFor(() => expect(h.suspensions().length).toBeGreaterThanOrEqual(2));
        };
        if (otherRunParks === 'before the follow-up is sent') await parkElsewhere();

        const sent =
          sentTo === 'the process that parked it'
            ? h.runtime.sendSignal(
                agent,
                { type: 'user-message', contents: 'my answer' },
                { resourceId, threadId },
                h.pubsub,
              )
            : otherRuntime.sendSignal(
                otherAgent,
                { type: 'user-message', contents: 'my answer' },
                { resourceId, threadId },
                h.pubsub,
              );
        expect((await sent.accepted).action).toBe('deliver');
        if (otherRunParks === 'after the follow-up is sent') await parkElsewhere();

        // The runtime executing the run starts the reply turn, with the follow-up as its input.
        await vi.waitFor(() => expect(turnsElsewhere).toHaveLength(1));
        expect(turnsHere).toHaveLength(0);
        expect(turnInputs).toHaveLength(1);
        expect(turnInputs[0]).toContain('my answer');
        const [replyRunId] = turnsElsewhere;
        await vi.waitFor(() => expect(h.registrations()).toHaveLength(3));
        await emitFinishEvent(h.pubsub, replyRunId!, {
          output: { text: 'done', steps: [] },
          stepResult: { reason: 'stop' },
        } as any);
        await vi.waitFor(() =>
          expect(otherRuntime.getActiveThreadRunId({ threadId, resourceId }, h.pubsub)).toBeUndefined(),
        );
        // Long enough for a turn the follow-up started here, once the reply turn ended, to begin.
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(turnsHere).toHaveLength(0);
        expect(turnsElsewhere).toHaveLength(1);
      } finally {
        first.cleanup();
        resumed.cleanup();
        for (const turn of turnStreams) turn.cleanup();
        await h.pubsub.close();
      }
    },
  );
  // Technical: the follow-up reaches this process before it has read the other process's `run-registered`, so this
  // process still sees the run parked here and starts the reply turn itself. The other process also took the
  // broadcast follow-up and, once its run parked, forwarded it to this process's new turn. This process admitted that
  // forward as new input, and after the reply turn ended it ran the same message as a second reply turn. (#30190)
  it('runs a follow-up sent to the process that parked it once, when it arrives while the other process is still registering its resume (#30190)', async () => {
    const h = setup();
    const threadId = 'continuation-thread';
    const resourceId = 'continuation-user';
    const turnStreams: Array<ReturnType<typeof h.makeStream>> = [];
    const turnInputs: string[] = [];
    const turnRunIds: string[] = [];
    const agentInProcess = (runtime: AgentThreadStreamRuntime) => {
      const agent = {
        id: 'continuation-agent',
        getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
        stream: vi.fn(async (input: unknown, options: { runId: string }) => {
          turnInputs.push(JSON.stringify(input));
          turnRunIds.push(options.runId);
          const turn = h.makeStream({ runId: options.runId });
          turnStreams.push(turn);
          await turn.ready;
          await runtime.registerRun(agent, turn.output, options as any, h.pubsub);
          return turn.output;
        }),
      } as unknown as Agent<any, any, any, any>;
      return agent;
    };
    const otherRuntime = new AgentThreadStreamRuntime();
    const agent = agentInProcess(h.runtime);
    const otherAgent = agentInProcess(otherRuntime);
    const first = h.makeStream();
    const resumed = h.makeStream();
    const finishTurns = async () => {
      for (const runId of turnRunIds) {
        await emitFinishEvent(h.pubsub, runId, {
          output: { text: 'done', steps: [] },
          stepResult: { reason: 'stop' },
        } as any);
      }
      // Long enough for a second turn the follow-up started to begin.
      await new Promise(resolve => setTimeout(resolve, 300));
    };
    try {
      await first.ready;
      await h.runtime.registerRun(agent, first.output, h.options, h.pubsub, { continuation: 'across-suspension' });
      await vi.waitFor(() => expect(h.registrations()).toHaveLength(1));
      await h.chunk('tool-call-suspended', { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} });
      await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
      await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));

      // Another process starts resuming the run; the follow-up is sent here before that registration lands.
      await resumed.ready;
      const registering = otherRuntime.registerRun(
        otherAgent,
        resumed.output,
        { ...h.options, toolCallId: 'call-1' } as any,
        h.pubsub,
        { continuation: 'across-suspension' },
      );
      const sent = h.runtime.sendSignal(
        agent,
        { type: 'user-message', contents: 'my answer' },
        { resourceId, threadId },
        h.pubsub,
      );
      await registering;
      expect((await sent.accepted).action).toBe('deliver');
      // This process starts the reply turn: it had not yet seen the other process take the run.
      await vi.waitFor(() => expect(turnInputs).toHaveLength(1));
      expect(turnInputs[0]).toContain('my answer');
      // The resumed run parks again in the other process.
      await h.chunk('tool-call-suspended', { toolCallId: 'call-2', toolName: 'ask', suspendPayload: {} });
      await new Promise(resolve => setTimeout(resolve, 300));

      await finishTurns();
      await finishTurns();
      expect(turnInputs).toHaveLength(1);
    } finally {
      first.cleanup();
      resumed.cleanup();
      for (const turn of turnStreams) turn.cleanup();
      await h.pubsub.close();
    }
  });
  // Technical: a process that parked a run marks its record `registeredElsewhere` once another process resumes the
  // run, and from then on only forwards the run's follow-ups to that process. Once the other process's resumed run
  // has ended, nothing executes the run any more, so a follow-up sent here was forwarded to a run nobody runs and
  // dropped, where before #30190 it stayed queued here. (#30190)
  it.each(['after this process read its end', 'while it ends'] as const)(
    'runs a follow-up sent to the process that parked it once when the other process finished the resumed run, sent %s (#30190)',
    async sentWhen => {
      const h = setup();
      const threadId = 'continuation-thread';
      const resourceId = 'continuation-user';
      const turnStreams: Array<ReturnType<typeof h.makeStream>> = [];
      const turnInputs: string[] = [];
      const agentInProcess = (runtime: AgentThreadStreamRuntime) => {
        const agent = {
          id: 'continuation-agent',
          getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
          stream: vi.fn(async (input: unknown, options: { runId: string }) => {
            turnInputs.push(JSON.stringify(input));
            const turn = h.makeStream({ runId: options.runId });
            turnStreams.push(turn);
            await turn.ready;
            await runtime.registerRun(agent, turn.output, options as any, h.pubsub);
            return turn.output;
          }),
        } as unknown as Agent<any, any, any, any>;
        return agent;
      };
      const otherRuntime = new AgentThreadStreamRuntime();
      const agent = agentInProcess(h.runtime);
      const otherAgent = agentInProcess(otherRuntime);
      // The first stream closes on its suspension and detaches, as a resume's stream does, so this process reads
      // nothing of the run after it parked.
      const first = h.makeStream({ closeOnSuspend: true });
      const resumed = h.makeStream();
      try {
        await first.ready;
        await h.runtime.registerRun(agent, first.output, h.options, h.pubsub);
        await vi.waitFor(() => expect(h.registrations()).toHaveLength(1));
        await h.chunk('tool-call-suspended', { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} });
        await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
        first.detach();

        // Another process resumes the run and runs it to its end.
        await resumed.ready;
        await otherRuntime.registerRun(
          otherAgent,
          resumed.output,
          { ...h.options, toolCallId: 'call-1' } as any,
          h.pubsub,
          { continuation: 'across-suspension' },
        );
        await vi.waitFor(() => expect(h.registrations()).toHaveLength(2));
        const send = () =>
          h.runtime.sendSignal(
            agent,
            { type: 'user-message', contents: 'my answer' },
            { resourceId, threadId },
            h.pubsub,
          ).accepted;
        if (sentWhen === 'while it ends') {
          // Sent once the other process has dropped the run, before this process reads that the run ended: the
          // follow-up is forwarded to an execution that no longer takes it.
          let sent = false;
          h.publish.mockImplementation(async (topic, event) => {
            if (!sent && event.type === 'run-completed' && event.runId === h.runId) {
              sent = true;
              await send();
            }
            return h.publishOriginal(topic, event);
          });
        }
        await h.finish();
        if (sentWhen === 'after this process read its end') {
          await vi.waitFor(() =>
            expect(otherRuntime.getActiveThreadRunId({ threadId, resourceId }, h.pubsub)).toBeUndefined(),
          );
          await vi.waitFor(() =>
            expect(h.runtime.getActiveThreadRunId({ threadId, resourceId }, h.pubsub)).toBeUndefined(),
          );
          await send();
        }
        await vi.waitFor(() => expect(turnInputs).toHaveLength(1), { timeout: 3_000 });
        expect(turnInputs[0]).toContain('my answer');
        // Long enough for a second turn with the same message to begin.
        await new Promise(resolve => setTimeout(resolve, 300));
        expect(turnInputs).toHaveLength(1);
      } finally {
        first.cleanup();
        resumed.cleanup();
        for (const turn of turnStreams) turn.cleanup();
        await h.pubsub.close();
      }
    },
  );
  // Technical: shutdown publishes `interrupted` for a run whose tool call still runs after the abort grace, and keeps
  // the run's lease. That ends the stream, not the run: recovery continues it. This process took the end as the run's
  // and started a turn for the follow-up it had forwarded, beside the tool still running there. (#30190)
  it('starts no turn for a follow-up sent to the process that parked it when the other process shuts down while the resumed tool still runs (#30190)', async () => {
    const h = setup();
    const threadId = 'continuation-thread';
    const resourceId = 'continuation-user';
    const turnStreams: Array<ReturnType<typeof h.makeStream>> = [];
    const turnInputs: string[] = [];
    const otherMastra = {};
    const agentInProcess = (runtime: AgentThreadStreamRuntime, durable: boolean) => {
      const agent = {
        id: 'continuation-agent',
        getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
        ...(durable ? { __hasDurableExecution: () => true, getMastraInstance: () => otherMastra } : {}),
        stream: vi.fn(async (input: unknown, options: { runId: string }) => {
          turnInputs.push(JSON.stringify(input));
          const turn = h.makeStream({ runId: options.runId });
          turnStreams.push(turn);
          await turn.ready;
          await runtime.registerRun(agent, turn.output, options as any, h.pubsub);
          return turn.output;
        }),
      } as unknown as Agent<any, any, any, any>;
      return agent;
    };
    const otherRuntime = new AgentThreadStreamRuntime();
    const agent = agentInProcess(h.runtime, false);
    const otherAgent = agentInProcess(otherRuntime, true);
    const first = h.makeStream({ closeOnSuspend: true });
    let resumed: ReturnType<typeof h.makeStream> | undefined;
    // The resumed tool call, which ignores the abort.
    const resumedStep = {};
    const settleResumedStep = startRunStep(resumedStep);
    try {
      await first.ready;
      await h.runtime.registerRun(agent, first.output, h.options, h.pubsub);
      await vi.waitFor(() => expect(h.registrations()).toHaveLength(1));
      await h.chunk('tool-call-suspended', { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} });
      await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
      first.detach();

      // Another process resumes the run; its resumed tool call is still running.
      resumed = h.makeStream();
      await resumed.ready;
      await otherRuntime.registerRun(
        otherAgent,
        resumed.output,
        { ...h.options, toolCallId: 'call-1' } as any,
        h.pubsub,
        { continuation: 'across-suspension', stepOwner: () => resumedStep },
      );
      await vi.waitFor(() => expect(h.registrations()).toHaveLength(2));

      // The follow-up is forwarded as that process hands the run back, so this process reads the hand-back before
      // the other process's admission of the follow-up.
      let sent: Promise<unknown> | undefined;
      h.publish.mockImplementation(async (topic, event) => {
        if (!sent && event.type === 'run-completed' && event.runId === h.runId) {
          sent = h.runtime.sendSignal(
            agent,
            { type: 'user-message', contents: 'my answer' },
            { resourceId, threadId },
            h.pubsub,
          ).accepted;
        }
        return h.publishOriginal(topic, event);
      });
      await otherRuntime.shutdown(h.pubsub, otherMastra, { abortGraceMs: 50 });
      expect(
        h.publish.mock.calls.filter(([, event]) => event.type === 'run-completed' && event.runId === h.runId),
      ).toEqual([
        [expect.anything(), expect.objectContaining({ data: expect.objectContaining({ status: 'interrupted' }) })],
      ]);
      await expect(sent).resolves.toMatchObject({ action: 'deliver' });

      // Long enough for a turn the follow-up started here to begin.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(turnInputs).toHaveLength(0);
    } finally {
      settleResumedStep();
      first.cleanup();
      resumed?.cleanup();
      for (const turn of turnStreams) turn.cleanup();
      await h.pubsub.close();
    }
  });
});

/**
 * A process that follows a run on another process forwards a follow-up to that run. The owner admits it as long as it
 * still has the run's end to handle, and runs it after the run. (#30190)
 */
describe('a follow-up a peer forwards while the run ends', () => {
  // Technical: the owner clears the run from its thread before it broadcasts the run's end. A peer that still sees the
  // run forwards a follow-up to it in that window, and keeps no copy. The #30190 admission guard refused every forward
  // once no run was active on the thread here, so that follow-up never ran. (#30190)
  it('runs a follow-up a peer forwards before the owner broadcasts the run end once, with auto-resume off (#30190)', async () => {
    const h = setup();
    const threadId = 'continuation-thread';
    const resourceId = 'continuation-user';
    const turnStreams: Array<ReturnType<typeof h.makeStream>> = [];
    const turnInputs: string[] = [];
    const agentInProcess = (runtime: AgentThreadStreamRuntime) => {
      const agent = {
        id: 'continuation-agent',
        getDefaultOptions: async () => ({ autoResumeSuspendedTools: false }),
        stream: vi.fn(async (input: unknown, options: { runId: string }) => {
          turnInputs.push(JSON.stringify(input));
          const turn = h.makeStream({ runId: options.runId });
          turnStreams.push(turn);
          await turn.ready;
          await runtime.registerRun(agent, turn.output, options as any, h.pubsub);
          return turn.output;
        }),
      } as unknown as Agent<any, any, any, any>;
      return agent;
    };
    const peer = new AgentThreadStreamRuntime();
    const agent = agentInProcess(h.runtime);
    const peerAgent = agentInProcess(peer);
    const target = { resourceId, threadId };
    const run = h.makeStream();
    const peerView = await peer.subscribeToThread(peerAgent, target, h.pubsub);
    const peerReading = (async () => {
      for await (const _part of peerView.stream);
    })();
    let releaseFinish = () => {};
    try {
      await run.ready;
      await h.runtime.registerRun(agent, run.output, h.options, h.pubsub);
      await h.chunk('text-delta', { id: 'text-1', text: 'working' });
      await vi.waitFor(() => expect(peer.getActiveThreadRunId(target, h.pubsub)).toBe(h.runId));

      // Hold the broadcast of the run's finish: the owner has cleared the run from its thread but not said it ended.
      const finishHeld = new Promise<void>(resolve => {
        releaseFinish = resolve;
      });
      h.publish.mockImplementation(async (topic, event) => {
        if (event.type === 'stream-part' && event.runId === h.runId && (event.data as any)?.part?.type === 'finish') {
          await finishHeld;
        }
        return h.publishOriginal(topic, event);
      });
      void h.finish();
      await vi.waitFor(() => expect(h.runtime.getActiveThreadRunId(target, h.pubsub)).toBeUndefined());
      expect(peer.getActiveThreadRunId(target, h.pubsub)).toBe(h.runId);

      const sent = peer.sendSignal(peerAgent, { type: 'user-message', contents: 'my answer' }, target, h.pubsub);
      expect((await sent.accepted).action).toBe('deliver');
      // Long enough for the owner to read the forward before the finish goes out.
      await new Promise(resolve => setTimeout(resolve, 50));
      releaseFinish();

      await vi.waitFor(() => expect(turnInputs).toHaveLength(1), { timeout: 3_000 });
      expect(turnInputs[0]).toContain('my answer');
      // Long enough for a second turn with the same message to begin.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(turnInputs).toHaveLength(1);
    } finally {
      releaseFinish();
      peerView.unsubscribe();
      await peerReading;
      run.cleanup();
      for (const turn of turnStreams) turn.cleanup();
      await h.pubsub.close();
    }
  });
});

/**
 * Work queued for after a run (`queueMessage`, `queueSignal`) starts a new run once the thread's run has ended. A run parked on a tool's suspend() has not ended, even with auto-resume on: only input for
 * the run itself (a sent message or a continuation) answers it. (#30190)
 */
describe('work queued for after a run that parks with auto-resume on', () => {
  // Technical: the #30190 release checked `#hasPendingThreadWork`, which counts the idle queue too. A message queued
  // with `queueSignal` while the run still worked started a turn once the run parked, while the same message queued a
  // moment later stayed queued. (#30190)
  it('stays queued when the run parks on a suspended tool, like work queued after it parked (#30190)', async () => {
    const h = setup();
    const threadId = 'continuation-thread';
    const resourceId = 'continuation-user';
    const turns: unknown[] = [];
    const agent = {
      id: 'continuation-agent',
      getDefaultOptions: async () => ({ autoResumeSuspendedTools: true }),
      stream: vi.fn(async (_signal: unknown, options: { runId: string }) => {
        turns.push(options);
        return { runId: options.runId };
      }),
    } as unknown as Agent<any, any, any, any>;
    const first = h.makeStream();
    await first.ready;
    try {
      await h.runtime.registerRun(agent, first.output, h.options, h.pubsub, { continuation: 'across-suspension' });
      await vi.waitFor(() => expect(h.registrations()).toHaveLength(1));

      // Queued while the run still works: it waits for the run to end.
      const queuedWhileRunning = h.runtime.queueSignal(
        agent,
        { type: 'user-message', contents: 'after this run' },
        { resourceId, threadId },
        h.pubsub,
      );
      expect((await queuedWhileRunning.accepted).action).toBe('deliver');

      await h.chunk('tool-call-suspended', { toolCallId: 'call-1', toolName: 'ask', suspendPayload: {} });
      await vi.waitFor(() => expect(first.output.status).toBe('suspended'));
      await vi.waitFor(() => expect(h.suspensions()).toHaveLength(1));

      // Queued after the run parked, the same way.
      const queuedAfterPark = h.runtime.queueSignal(
        agent,
        { type: 'user-message', contents: 'after this run too' },
        { resourceId, threadId },
        h.pubsub,
      );
      expect((await queuedAfterPark.accepted).action).toBe('deliver');
      // Long enough for a turn the queued work started to begin.
      await new Promise(resolve => setTimeout(resolve, 300));
      expect(turns).toHaveLength(0);
      expect(h.runtime.getActiveThreadRunId({ threadId, resourceId }, h.pubsub)).toBe(h.runId);
    } finally {
      first.cleanup();
      await h.pubsub.close();
    }
  });
});
