import type { ChatCompletionRequest } from '@copilotkit/aimock';
import { expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createTestSession } from '../../../../agent-controller/test-utils';
import type { AgentControllerConfig, AgentControllerEvent } from '../../../../agent-controller/types';
import { createTool } from '../../../../tools';
import { createSharedAgent, describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import { requestText } from '../network-fixtures';
import { isDurableEngineVariant } from '../types';

type ToolCallFixture = { id: string; name: string; arguments: Record<string, unknown> };
type StepResponse = { toolCalls: ToolCallFixture[] } | { content: string };

let testCount = 0;

/**
 * An AgentController decides tool approval from the session's permission rules (#30131).
 * Calls the rules allow run without pausing the run, and calls in one step that need no
 * approval run at the same time on the regular loop.
 */
describeForAllEngines('Controller runs tools by the session permission rules', engine => {
  const getMock = useLoopScenarioAimock();
  // Durable engines keep a function approval policy out of serialized state and run a
  // step's calls one at a time while any approval policy is set.
  const runsInParallel = !isDurableEngineVariant(engine);

  async function setup({
    tools,
    toolCategoryResolver = name => (name.startsWith('read') ? 'read' : name.startsWith('write') ? 'edit' : null),
  }: {
    tools: Record<string, ReturnType<typeof createTool>>;
    toolCategoryResolver?: AgentControllerConfig['toolCategoryResolver'];
  }) {
    const llm = getMock();
    const { agent } = await createSharedAgent(llm, { engine, tools });
    const { controller, session } = await createTestSession({ agent, toolCategoryResolver });
    await session.thread.create();
    await session.permissions.setForCategory({ category: 'read', policy: 'allow' });
    await session.permissions.setForCategory({ category: 'edit', policy: 'ask' });
    const events: AgentControllerEvent[] = [];
    session.subscribe(event => {
      events.push(event);
    });

    // A run from an earlier test can still reach the shared mock after its controller is
    // destroyed, so fixtures match this test's prompt. Each step answers once the calls of
    // the steps before it are in the history and its own calls are not.
    // A counter rather than randomUUID(), which the test setup stubs to the same value in every test.
    const marker = `[approval-policy-${engine}-${++testCount}]`;
    const ownRequest = (req: ChatCompletionRequest | null) => requestText(req).includes(marker);
    const callIds = (response: StepResponse) =>
      'toolCalls' in response ? response.toolCalls.map(call => call.id) : [];
    const script = (responses: StepResponse[]) =>
      responses.forEach((response, index) => {
        const earlier = responses.slice(0, index).flatMap(callIds);
        const own = callIds(response);
        llm.on(
          {
            endpoint: 'chat',
            predicate: req => {
              const history = JSON.stringify(req.messages);
              return (
                ownRequest(req) && earlier.every(id => history.includes(id)) && !own.some(id => history.includes(id))
              );
            },
          },
          response,
        );
      });
    const send = (content: string) => session.sendMessage({ content: `${content} ${marker}` });
    const requests = () => llm.getRequests().filter(entry => ownRequest(entry.body));

    // Each approval the controller sends back to the agent is one paused-and-resumed call.
    const approvalRoundTrips = vi.spyOn(agent, 'sendToolApproval');
    const approvalCards = () =>
      events.flatMap(event => (event.type === 'tool_approval_required' ? [event.toolCallId] : []));
    const waitForEnd = () =>
      vi.waitFor(() => expect(events.some(event => event.type === 'agent_end')).toBe(true), { timeout: 15_000 });
    return { controller, session, events, script, send, requests, approvalRoundTrips, approvalCards, waitForEnd };
  }

  function recordingTool(id: string, calls: string[], run?: (name: string) => Promise<void>) {
    return createTool({
      id,
      description: `${id} a value`,
      inputSchema: z.object({ name: z.string() }),
      execute: async ({ name }) => {
        calls.push(`${id}:${name}`);
        await run?.(name);
        return { name };
      },
    });
  }

  it('runs allowed calls without pausing, and two in one step at the same time', async () => {
    const calls: string[] = [];
    let releaseB!: () => void;
    const bStarted = new Promise<void>(resolve => (releaseB = resolve));
    let overlapped = false;
    const readTool = recordingTool('read_value', calls, async name => {
      if (name === 'b') return releaseB();
      // Call a waits for call b to start; it gives up after a while when the calls run one at a time.
      overlapped = await Promise.race([
        bStarted.then(() => true),
        new Promise<boolean>(resolve => setTimeout(() => resolve(false), 1_500)),
      ]);
    });
    const env = await setup({ tools: { read_value: readTool } });
    env.script([
      {
        toolCalls: [
          { id: 'call-a', name: 'read_value', arguments: { name: 'a' } },
          { id: 'call-b', name: 'read_value', arguments: { name: 'b' } },
        ],
      },
      { content: 'done' },
    ]);

    try {
      await env.send('Read a and b.');
      await env.waitForEnd();

      expect(calls.sort()).toEqual(['read_value:a', 'read_value:b']);
      expect(env.approvalCards()).toEqual([]);
      expect(env.approvalRoundTrips).not.toHaveBeenCalled();
      expect(overlapped).toBe(runsInParallel);
    } finally {
      await env.controller.destroy();
    }
  });

  it('asks only for the call the rules do not allow, and declining it adds no pause for allowed calls', async () => {
    const calls: string[] = [];
    const env = await setup({
      tools: { read_value: recordingTool('read_value', calls), write_value: recordingTool('write_value', calls) },
    });
    env.session.subscribe(event => {
      if (event.type === 'tool_approval_required') {
        queueMicrotask(() => env.session.respondToToolApproval({ decision: 'decline', toolCallId: event.toolCallId }));
      }
    });
    env.script([
      {
        toolCalls: [
          { id: 'call-read', name: 'read_value', arguments: { name: 'a' } },
          { id: 'call-write', name: 'write_value', arguments: { name: 'a' } },
        ],
      },
      { toolCalls: [{ id: 'call-read-again', name: 'read_value', arguments: { name: 'b' } }] },
      { content: 'done' },
    ]);

    try {
      await env.send('Read and write a, then read b.');
      await vi.waitFor(() => expect(calls).toContain('read_value:b'), { timeout: 15_000 });

      expect(env.approvalCards()).toEqual(['call-write']);
      expect(calls).toEqual(['read_value:a', 'read_value:b']);
      // Only the declined call paused; the run continues with the session's rules, so the
      // read after it is not sent through approval again.
      expect(env.approvalRoundTrips).toHaveBeenCalledTimes(1);
    } finally {
      await env.controller.destroy();
    }
  });

  it('declines a call whose category the rules deny, without running it or asking', async () => {
    const calls: string[] = [];
    const env = await setup({ tools: { write_value: recordingTool('write_value', calls) } });
    await env.session.permissions.setForCategory({ category: 'edit', policy: 'deny' });
    env.script([
      { toolCalls: [{ id: 'call-write', name: 'write_value', arguments: { name: 'a' } }] },
      { content: 'done' },
    ]);

    try {
      await env.send('Write a.');
      await vi.waitFor(
        () => expect(env.events).toContainEqual(expect.objectContaining({ type: 'tool_end', denied: true })),
        { timeout: 15_000 },
      );

      expect(calls).toEqual([]);
      expect(env.approvalCards()).toEqual([]);
    } finally {
      await env.controller.destroy();
    }
  });

  it('still asks before a later call after the user answers ask_user', async () => {
    const calls: string[] = [];
    const env = await setup({ tools: { write_value: recordingTool('write_value', calls) } });
    await env.session.permissions.setForTool({ toolName: 'ask_user', policy: 'allow' });
    env.session.subscribe(event => {
      if (event.type === 'tool_suspended' && event.toolName === 'ask_user') {
        queueMicrotask(() => env.session.respondToToolSuspension({ resumeData: 'the blue one' }));
      }
      if (event.type === 'tool_approval_required') {
        queueMicrotask(() => env.session.respondToToolApproval({ decision: 'decline', toolCallId: event.toolCallId }));
      }
    });
    env.script([
      { toolCalls: [{ id: 'call-ask', name: 'ask_user', arguments: { question: 'Which one?' } }] },
      { toolCalls: [{ id: 'call-write', name: 'write_value', arguments: { name: 'blue' } }] },
      { content: 'done' },
    ]);

    try {
      await env.send('Ask me, then write my answer.');
      await vi.waitFor(
        () =>
          expect(env.events).toContainEqual(expect.objectContaining({ type: 'tool_end', toolCallId: 'call-write' })),
        { timeout: 15_000 },
      );

      expect(env.approvalCards()).toEqual(['call-write']);
      expect(calls).toEqual([]);
      expect(JSON.stringify(env.requests()[1]?.body)).toContain('the blue one');
    } finally {
      await env.controller.destroy();
    }
  });

  it.each([
    { label: 'a later step', sameStep: false },
    { label: 'the same step', sameStep: true },
  ])(
    'asks for a call in $label the user restricted while an earlier call waited for approval',
    async ({ sameStep }) => {
      const calls: string[] = [];
      const env = await setup({
        tools: { read_value: recordingTool('read_value', calls), write_value: recordingTool('write_value', calls) },
      });
      const write = { id: 'call-write', name: 'write_value', arguments: { name: 'a' } };
      const read = { id: 'call-read', name: 'read_value', arguments: { name: 'a' } };
      env.script(
        sameStep
          ? [{ toolCalls: [write, read] }, { content: 'done' }]
          : [{ toolCalls: [write] }, { toolCalls: [read] }, { content: 'done' }],
      );

      try {
        // The turn stays open while a call waits for approval.
        const sent = env.send('Write a, then read a.');
        void sent.catch(() => {});
        await vi.waitFor(() => expect(env.approvalCards()).toEqual(['call-write']), { timeout: 15_000 });
        await env.session.permissions.setForTool({ toolName: 'read_value', policy: 'ask' });
        env.session.respondToToolApproval({ decision: 'approve', toolCallId: 'call-write' });
        await vi.waitFor(() => expect(env.approvalCards()).toEqual(['call-write', 'call-read']), { timeout: 15_000 });

        expect(calls).toEqual(['write_value:a']);
        env.session.respondToToolApproval({ decision: 'decline', toolCallId: 'call-read' });
        await sent;
      } finally {
        await env.controller.destroy();
      }
    },
  );

  /**
   * Parks a `confirm` call on the run's thread, then opens another thread with different
   * edit rules and answers the parked call from there. The model writes next.
   */
  async function answerFromAnotherThread({
    writeNext,
    runThreadEdits = 'allow',
    otherThreadEdits = 'ask',
  }: {
    writeNext: boolean;
    runThreadEdits?: 'allow' | 'deny';
    otherThreadEdits?: 'allow' | 'ask';
  }) {
    const calls: string[] = [];
    const confirm = createTool({
      id: 'confirm',
      description: 'Ask the user to confirm',
      inputSchema: z.object({ question: z.string() }),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ ok: z.boolean() }),
      execute: async ({ question }, context) => {
        if (context?.agent?.resumeData) return { ok: true };
        return context?.agent?.suspend?.({ question });
      },
    });
    const env = await setup({
      tools: { confirm, write_value: recordingTool('write_value', calls) },
      toolCategoryResolver: name => (name === 'write_value' ? 'edit' : 'read'),
    });
    await env.session.permissions.setForCategory({ category: 'edit', policy: runThreadEdits });
    const runThreadId = env.session.thread.requireId();
    env.script([
      { toolCalls: [{ id: 'call-confirm', name: 'confirm', arguments: { question: 'Go?' } }] },
      writeNext
        ? { toolCalls: [{ id: 'call-write', name: 'write_value', arguments: { name: 'a' } }] }
        : { content: 'done' },
      { content: 'done' },
    ]);

    void env.send('Confirm, then write a.').catch(() => {});
    await vi.waitFor(
      () => expect(env.events).toContainEqual(expect.objectContaining({ type: 'tool_suspended', toolName: 'confirm' })),
      { timeout: 15_000 },
    );
    const suspended = env.events.find(event => event.type === 'tool_suspended');
    if (suspended?.type !== 'tool_suspended' || !suspended.runId || !suspended.resourceId) {
      throw new Error('Expected a suspension with its run address');
    }
    await env.session.thread.create();
    await env.session.permissions.setForCategory({ category: 'edit', policy: otherThreadEdits });
    expect(env.session.thread.requireId()).not.toBe(runThreadId);

    const answered = env.session.respondToToolSuspension({
      resumeData: { ok: true },
      address: {
        threadId: runThreadId,
        resourceId: suspended.resourceId,
        runId: suspended.runId,
        toolCallId: 'call-confirm',
      },
    });
    return { env, calls, answered };
  }

  it("allows a call by its own thread's rules when the user answers the run from another thread", async () => {
    const { env, calls, answered } = await answerFromAnotherThread({ writeNext: true });
    void answered.catch(() => {});
    try {
      await vi.waitFor(() => expect(calls).toEqual(['write_value:a']), { timeout: 15_000 });
      expect(env.approvalCards()).toEqual([]);
    } finally {
      await env.controller.destroy();
    }
  });

  it('declines a call its own thread denies when the user answers the run from a thread that allows it', async () => {
    const { env, calls, answered } = await answerFromAnotherThread({
      writeNext: true,
      runThreadEdits: 'deny',
      otherThreadEdits: 'allow',
    });
    void answered.catch(() => {});
    try {
      await vi.waitFor(() => expect(env.requests()).toHaveLength(3), { timeout: 15_000 });
      expect(JSON.stringify(env.requests()[2]?.body)).toContain('call-write');
      expect(calls).toEqual([]);
      expect(env.approvalCards()).toEqual([]);
    } finally {
      await env.controller.destroy();
    }
  });

  // Durable engines deliver the resumed run's last chunks after its request context is
  // released, so the answer used to wait for a `finish` it never recognised (#30150).
  it('returns the answer from another thread once the resumed run ends', async () => {
    const { env, answered } = await answerFromAnotherThread({ writeNext: false });
    try {
      await Promise.race([
        answered,
        new Promise((_, reject) => setTimeout(() => reject(new Error('The answer did not return')), 5_000)),
      ]);
    } finally {
      await env.controller.destroy();
    }
  });
});
