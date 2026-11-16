import { describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../events';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '../../request-context';
import type { Agent } from '../agent';
import { createDurableAgentStream, emitChunkEvent, emitErrorEvent, emitFinishEvent } from '../durable/stream-adapter';
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
