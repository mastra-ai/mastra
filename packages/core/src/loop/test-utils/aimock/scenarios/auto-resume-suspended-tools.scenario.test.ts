import { expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod/v4';
import { getRunRegistryEntry } from '../../../../agent/durable/run-registry';
import { AgentThreadStreamRuntime } from '../../../../agent/thread-stream-runtime';
import type { PubSub } from '../../../../events/pubsub';
import { MockMemory } from '../../../../memory';
import type { MastraModelOutput } from '../../../../stream/base/output';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import {
  createSharedAgent,
  createSharedAgentInAnotherProcess,
  runLoopScenario,
  useLoopScenarioAimock,
  describeForAllEngines,
} from '../aimock-scenario';

/**
 * Automatic tool resumption with `autoResumeSuspendedTools`.
 *
 * When a tool suspends for data and the agent has
 * `defaultOptions: { autoResumeSuspendedTools: true }`, the agent can
 * automatically resume it from the next user message in the same thread.
 * Approval suspensions are intentionally excluded because consent must arrive
 * through the explicit approval APIs.
 *
 * Regression classes:
 * - A data-bearing tool suspension is persisted in memory
 * - `autoResumeSuspendedTools` detects it on the next call
 * - The model supplies schema-valid `resumeData` from the user's message
 * - Final output reflects the resumed tool's result
 */
describeForAllEngines(
  'AIMock loop scenario: autoResumeSuspendedTools',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('auto-resumes a suspended tool when the user sends a follow-up message on the same thread', async () => {
      let toolExecuted = false;
      let toolInputName = '';

      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({
          query: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          name: z.string(),
        }),
        execute: async (_inputData, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend({ message: 'Which user should I find?' });
          }
          toolExecuted = true;
          toolInputName = context.agent.resumeData.name;
          return { name: toolInputName, email: `${toolInputName.toLowerCase()}@test.com` };
        },
      });

      // Build a shared agent with autoResumeSuspendedTools enabled
      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { findUserTool },
        memory: sharedMemory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
        engine,
      });

      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      // First call: model calls the tool, which suspends for the user's name
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Find the user named Dero Israel',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/find/i, {
            toolCalls: [
              {
                id: 'call-1',
                name: 'find-user',
                arguments: { query: 'user by name' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: the tool suspended for data rather than approval.
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);
      expect(chunks!.some(c => c.type === 'tool-call-approval')).toBe(false);

      // Tool should NOT have executed yet (suspended before execution)
      expect(toolExecuted).toBe(false);

      // Second call: user sends follow-up on same thread.
      // With autoResumeSuspendedTools, the loop detects the suspended tool
      // and modifies the system prompt to instruct the model about it.
      const { output, requests: secondCallRequests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'The user is Dero Israel',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          // Turn 1 of second call: model re-calls the tool with resumeData
          // (responding to the auto-resume instruction in the system prompt)
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call-2',
                  name: 'find-user',
                  arguments: { query: 'user by name', resumeData: { name: 'Dero Israel' } },
                },
              ],
            },
          );
          // Turn 2 of second call: after tool executes, model gets result and returns text
          llm.on(
            { endpoint: 'chat', toolCallId: 'call-2', hasToolResult: true },
            {
              content: 'User found: Dero Israel (dero.israel@test.com)',
            },
          );
        },
      });

      // Assert: system prompt was modified to mention suspended tools
      // AIMock captures ALL requests across calls; the second call's first request is at index 1
      // (index 0 is from the first call which had no suspended tools yet)
      const secondCallFirstRequest = secondCallRequests[1];
      const systemMessage = secondCallFirstRequest?.body?.messages?.find((m: any) => m.role === 'system');
      expect(systemMessage?.content).toContain('suspended tools');

      // Assert: tool was executed during the auto-resume
      expect(toolExecuted).toBe(true);
      expect(toolInputName).toBe('Dero Israel');

      // Assert: final output mentions the user
      const text = await output.text;
      expect(text.length).toBeGreaterThan(0);
    });

    /** The user's follow-up in the #30190 cases: the answer the suspended tool is waiting for. */
    const FOLLOW_UP = 'The user is Dero Israel';

    /**
     * Studio's flow for #30190: the first message streams on a new thread and the tool
     * suspends; the follow-up goes through `sendMessage` on the same thread.
     *
     * - `suspendsIn: 'workflow'` is the issue's own setup: a workflow used as a tool, whose
     *   `preflight` step runs before the step that suspends.
     * - `release` holds the suspending code inside `execute` until the test lets it suspend.
     * - `replyFrom: 'other-runtime'` sends the reply from a second runtime subscribed to the
     *   thread, as another server process behind the same pubsub would.
     * - `replyFrom: 'claimed-owner'` claims the thread for the agent's runtime and sends the reply
     *   from a second runtime that cannot see the run, asking the claimed owner to wake, as a
     *   channel or schedule in another process does.
     * - `sibling` has the model call a second, slow tool alongside the one that suspends; it runs
     *   until the test releases it.
     * - `firstMessageAutoResume` sets `autoResumeSuspendedTools` on the first message's stream call,
     *   overriding the agent's default (on).
     */
    async function createStudioThread({
      suspendsIn,
      release = Promise.resolve(),
      replyFrom = 'same-runtime',
      sibling,
      firstMessageAutoResume,
    }: {
      suspendsIn: 'tool' | 'workflow';
      release?: Promise<void>;
      replyFrom?: 'same-runtime' | 'other-runtime' | 'claimed-owner';
      sibling?: { release: Promise<void> };
      firstMessageAutoResume?: boolean;
    }) {
      const seen = {
        entered: false,
        /** The tool's suspend() call has returned. */
        suspended: false,
        resumedWith: undefined as string | undefined,
        preflightRuns: 0,
        resumes: 0,
        workflowRunIds: [] as string[],
        siblingStarted: false,
        siblingFinished: false,
        /** Model requests carrying the reply that were sent while the sibling tool still ran. */
        replyRequestsWhileSiblingRan: 0,
      };
      const requestsWithReply = () =>
        getMock()
          .getRequests()
          .filter(request => JSON.stringify(request.body.messages).includes(FOLLOW_UP)).length;
      const slowTool = createTool({
        id: 'slow',
        description: 'Takes a while',
        inputSchema: z.object({}),
        execute: async () => {
          seen.siblingStarted = true;
          await sibling?.release;
          seen.replyRequestsWhileSiblingRan = requestsWithReply();
          seen.siblingFinished = true;
          return { done: true };
        },
      });
      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({ query: z.string() }),
        // A suspend schema makes the step run its tool calls one at a time; without one, the
        // sibling runs beside the call that suspends.
        ...(sibling ? {} : { suspendSchema: z.object({ message: z.string() }) }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async (_inputData, context) => {
          if (!context?.agent?.resumeData) {
            seen.entered = true;
            await release;
            const suspended = await context?.agent?.suspend({ message: 'Which user should I find?' });
            seen.suspended = true;
            return suspended;
          }
          seen.resumes++;
          seen.resumedWith = context.agent.resumeData.name;
          return { name: seen.resumedWith };
        },
      });
      const preflight = createStep({
        id: 'preflight',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ query: z.string() }),
        execute: async ({ inputData }) => {
          seen.preflightRuns++;
          return inputData;
        },
      });
      const askForName = createStep({
        id: 'ask-for-name',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ name: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async ({ runId, resumeData, suspend }) => {
          seen.workflowRunIds.push(runId);
          if (!resumeData) {
            seen.entered = true;
            await release;
            return suspend({ message: 'Which user should I find?' });
          }
          seen.resumes++;
          seen.resumedWith = resumeData.name;
          return { name: resumeData.name };
        },
      });
      const findUserWorkflow = createWorkflow({
        id: 'find-user',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ name: z.string() }),
      })
        .then(preflight)
        .then(askForName)
        .commit();

      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        ...(suspendsIn === 'tool'
          ? { tools: { findUserTool, ...(sibling ? { slow: slowTool } : {}) } }
          : { workflows: { findUserTool: findUserWorkflow } }),
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      });
      // The thread runtime publishes `run-suspended` once the run has parked.
      const published = vi.spyOn(shared.mastra.pubsub as PubSub, 'publish');
      onTestFinished(() => published.mockRestore());
      const waitForParked = () =>
        vi.waitFor(
          () =>
            expect(
              published.mock.calls.some(
                ([, event]) => (event.data as { type?: string } | undefined)?.type === 'run-suspended',
              ),
            ).toBe(true),
          { timeout: 5_000 },
        );
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();
      // The model calls a workflow tool by its registered name, with the input under `inputData`.
      const toolName = suspendsIn === 'tool' ? 'find-user' : 'workflow-findUserTool';
      const toolArgs = suspendsIn === 'tool' ? { query: 'user by name' } : { inputData: { query: 'user by name' } };

      const llm = getMock();
      // Registered first: once the resumed tool answers, the model replies.
      llm.on({ endpoint: 'chat', toolCallId: 'call-2', hasToolResult: true }, { content: 'FINAL_REPLY Dero Israel' });
      // The follow-up turn re-calls the tool with the answer read from the user's reply.
      llm.onMessage(/The user is Dero Israel/, {
        toolCalls: [
          {
            id: 'call-2',
            name: toolName,
            arguments: { ...toolArgs, suspendedToolCallId: 'call-1', resumeData: { name: 'Dero Israel' } },
          },
        ],
      });

      const otherRuntime = new AgentThreadStreamRuntime();
      const otherView =
        replyFrom === 'other-runtime'
          ? await otherRuntime.subscribeToThread(shared.agent, { resourceId, threadId }, shared.mastra.pubsub)
          : undefined;
      onTestFinished(() => otherView?.unsubscribe());

      const firstMessage = () =>
        runLoopScenario({
          engine,
          llm,
          sharedAgent: shared,
          prompt: 'Find the user named Dero Israel',
          memory,
          threadId,
          resourceId,
          fixtures: mock => {
            mock.onMessage(/find/i, {
              toolCalls: [
                { id: 'call-1', name: toolName, arguments: toolArgs },
                ...(sibling ? [{ id: 'call-slow', name: 'slow', arguments: {} }] : []),
              ],
            });
          },
          collectChunks: true,
          ...(firstMessageAutoResume !== undefined ? { autoResumeSuspendedTools: firstMessageAutoResume } : {}),
        });
      const sendFollowUp = async () => {
        if (replyFrom === 'claimed-owner') {
          const claim = await shared.agent.claimThreadOwnership({ resourceId, threadId });
          onTestFinished(() => claim.unsubscribe());
          return otherRuntime.sendSignal(
            shared.agent,
            { type: 'user-message', contents: FOLLOW_UP },
            { resourceId, threadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
            shared.mastra.pubsub,
          ).accepted;
        }
        if (!otherView) return shared.agent.sendMessage(FOLLOW_UP, { resourceId, threadId }).accepted;
        // The other runtime only sees the run through the thread's pubsub.
        const runId = await vi.waitFor(() => {
          const active = otherView.activeRunId();
          if (active === null) throw new Error('The other runtime has not seen the run on the thread yet');
          return active;
        });
        return otherRuntime.sendMessage(shared.agent, FOLLOW_UP, { resourceId, threadId, runId }, shared.mastra.pubsub)
          .accepted;
      };
      const waitForIdle = async () => {
        const view = await shared.agent.subscribeToThread({ resourceId, threadId });
        try {
          await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 7_000 });
        } finally {
          view.unsubscribe();
        }
      };
      /**
       * Waits for the final answer to land and the thread to go idle, then checks the reply ran exactly one
       * turn: the thread holds the reply once and the final answer once, the tool or workflow resumed once, and the model got three
       * requests. Those are the first message's request and the reply turn's two (the re-call that resumes
       * the tool, then the final answer); only the reply turn's two carry the reply.
       */
      const expectReplyHandledOnce = async () => {
        // Both waits fit the test's 20 s timeout, so a reply that never runs fails on an assertion.
        const deadline = Date.now() + 7_000;
        let { messages } = await memory.recall({ threadId, resourceId });
        while (!messages.some(m => textOf(m).includes('FINAL_REPLY')) && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
          ({ messages } = await memory.recall({ threadId, resourceId }));
        }
        // A second turn could start after the first answer lands, so count only once no run holds the thread.
        await waitForIdle();
        ({ messages } = await memory.recall({ threadId, resourceId }));
        // The reply is stored as the user-message signal that carried it.
        expect(messages.filter(m => textOf(m).includes(FOLLOW_UP))).toHaveLength(1);
        expect(
          messages.filter(m => m.role === 'assistant' && textOf(m).includes('FINAL_REPLY Dero Israel')),
        ).toHaveLength(1);
        expect(seen.resumedWith).toBe('Dero Israel');
        expect(seen.resumes).toBe(1);
        expect(requestsWithReply()).toBe(2);
        expect(llm.getRequests()).toHaveLength(3);
      };
      return {
        seen,
        llm,
        shared,
        threadId,
        resourceId,
        firstMessage,
        sendFollowUp,
        waitForParked,
        requestsWithReply,
        expectReplyHandledOnce,
      };
    }

    /** The text of a stored message's text parts. */
    const textOf = (message: { content: { parts?: Array<{ type: string; text?: string }> } }) =>
      (message.content.parts ?? []).map(part => (part.type === 'text' ? part.text : '')).join('');

    // Technical: the runtime treated the run parked on the tool's suspend() as the thread's
    // active run and queued the follow-up onto it, answering `deliver`; a parked run never
    // drains its queue, so no next turn ran and auto-resume never fired. (#30190)
    it('auto-resumes a suspended tool when the follow-up arrives through sendMessage, as Studio sends it (#30190)', async () => {
      const { llm, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'tool',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      // The follow-up is saved to the thread once, the suspended tool resumes once with the
      // user's answer, and the final reply lands in the same thread once.
      await expectReplyHandledOnce();
      // The model saw the follow-up in the turn that resumed the tool.
      expect(JSON.stringify(llm.getRequests().at(-2)?.body.messages)).toContain(FOLLOW_UP);
    });

    // Technical: a follow-up sent while the tool is still running is queued for the run's next
    // step, but the run then parks on suspend() and never takes another step. (#30190)
    it('auto-resumes with a follow-up sent while the tool was still running, once the tool suspends (#30190)', async () => {
      let releaseTool!: () => void;
      const { seen, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'tool',
        release: new Promise<void>(resolve => (releaseTool = resolve)),
      });

      const first = firstMessage();
      await vi.waitFor(() => expect(seen.entered).toBe(true));
      await sendFollowUp();
      releaseTool();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      await expectReplyHandledOnce();
    });

    // Technical: the release that #30190 added starts any queued thread work once the run parks,
    // not only user messages. A continuation (`sendToolApproval` with `messages`) queued while the
    // tool still runs starts the next turn after the tool suspends, and is handled once. (#30190)
    it('runs a continuation queued while the tool was still running once the tool suspends (#30190)', async () => {
      let releaseTool!: () => void;
      const { seen, shared, threadId, resourceId, firstMessage, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'tool',
        release: new Promise<void>(resolve => (releaseTool = resolve)),
      });

      const first = firstMessage();
      await vi.waitFor(() => expect(seen.entered).toBe(true));
      await shared.agent.sendToolApproval({ threadId, resourceId, approved: true, messages: FOLLOW_UP });
      releaseTool();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      await expectReplyHandledOnce();
    });

    // Technical: the release ran when a run parked and when a message was queued onto a parked run, but not when a
    // continuation was, so one queued after the tool suspended waited for a turn that never started. (#30190)
    it('runs a continuation queued after the tool suspended (#30190)', async () => {
      const { shared, threadId, resourceId, firstMessage, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'tool',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await shared.agent.sendToolApproval({ threadId, resourceId, approved: true, messages: FOLLOW_UP });

      await expectReplyHandledOnce();
    });

    // Technical: a step that raises a suspension ends its segment while a sibling tool call of
    // that step still runs. The run counts as parked from then on, so the reply released the
    // thread and the next turn ran beside the sibling call. The reply has to wait until the
    // run's steps settle. (#30190)
    it('starts the reply turn only after a sibling tool call of the suspended step has finished (#30190)', async () => {
      let releaseSibling!: () => void;
      const { seen, firstMessage, sendFollowUp, waitForParked, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'tool',
        sibling: { release: new Promise<void>(resolve => (releaseSibling = resolve)) },
      });

      const first = firstMessage();
      await vi.waitFor(() => {
        expect(seen.entered).toBe(true);
        expect(seen.siblingStarted).toBe(true);
      });
      // The suspension is raised while the sibling still runs. Evented and Inngest park the run right
      // then; normal and durable keep the step open until the sibling settles, so there the reply is
      // queued onto the working run and the release runs once it parks.
      await vi.waitFor(() => expect(seen.suspended).toBe(true));
      if (engine === 'evented' || engine === 'inngest') await waitForParked();
      expect(seen.siblingFinished).toBe(false);
      await sendFollowUp();
      // Long enough for a turn the reply started to reach the model. A new Inngest turn takes over a second to get
      // there, so a shorter wait would pass there even if nothing held the reply back.
      await new Promise(resolve => setTimeout(resolve, engine === 'inngest' ? 3_000 : 300));
      releaseSibling();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      await expectReplyHandledOnce();
      expect(seen.siblingFinished).toBe(true);
      expect(seen.replyRequestsWhileSiblingRan).toBe(0);
    });

    // Technical: the #30190 release reads `autoResumeSuspendedTools` from the run's own call
    // options before the agent's default. A call that turned auto-resume off keeps the old
    // behavior: the follow-up stays queued on the parked run until an explicit resume. (#30190)
    it('keeps a follow-up queued on the paused run when the first call turned auto-resume off (#30190)', async () => {
      const { seen, shared, threadId, resourceId, firstMessage, requestsWithReply } = await createStudioThread({
        suspendsIn: 'tool',
        firstMessageAutoResume: false,
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      const runId = first.output.runId;
      const view = await shared.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());

      await shared.agent.sendMessage(FOLLOW_UP, { resourceId, threadId }).accepted;
      // Long enough for a turn the follow-up started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsWithReply()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
      expect(seen.resumes).toBe(0);
    });

    // Technical: a resume that omits `autoResumeSuspendedTools` is handed the agent's default, and
    // the runtime stored the resume's options as the run's, so the run's own `false` became the
    // default `true`. Once the resumed run parked on another suspend(), the follow-up started a
    // turn as if the run had auto-resume on. (#30190)
    // A resume that turns auto-resume on itself is the run's choice from then on: the follow-up starts the turn.
    it.each([
      { resumeAutoResume: undefined, outcome: 'keeps a follow-up queued' },
      { resumeAutoResume: true, outcome: 'starts the follow-up turn' },
    ] as const)(
      '$outcome when a run that turned auto-resume off is resumed with autoResumeSuspendedTools $resumeAutoResume and pauses again (#30190)',
      async ({ resumeAutoResume }) => {
        const ANSWER_FOLLOW_UP = 'Here is my second answer';
        const seen = { answers: [] as string[] };
        const askTool = createTool({
          id: 'ask',
          description: 'Asks the user a question',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async ({ question }, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({ message: question });
            seen.answers.push(context.agent.resumeData.answer);
            return { answer: context.agent.resumeData.answer };
          },
        });
        const memory = new MockMemory();
        const shared = await createSharedAgent(getMock(), {
          tools: { askTool },
          memory,
          defaultOptions: { autoResumeSuspendedTools: true },
          engine,
        });
        const threadId = globalThis.crypto.randomUUID();
        const resourceId = globalThis.crypto.randomUUID();

        const llm = getMock();
        // Registered first: a turn the follow-up started would answer it.
        llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), { content: 'FOLLOW_UP_TURN' });
        // Once the first question is answered, the model asks a second one, which pauses the run again.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-q1', hasToolResult: true },
          { toolCalls: [{ id: 'call-q2', name: 'ask', arguments: { question: 'second?' } }] },
        );

        const first = await runLoopScenario({
          engine,
          llm,
          sharedAgent: shared,
          prompt: 'Ask me two questions',
          memory,
          threadId,
          resourceId,
          fixtures: mock => {
            mock.onMessage(/two questions/, {
              toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'first?' } }],
            });
          },
          collectChunks: true,
          autoResumeSuspendedTools: false,
        });
        expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
        const runId = first.output.runId;

        // The explicit resume names the run and its answer, and passes `autoResumeSuspendedTools` only in the second case.
        const resumed = await shared.agent.resumeStream(
          { answer: 'first answer' },
          {
            runId,
            toolCallId: 'call-q1',
            ...(resumeAutoResume !== undefined ? { autoResumeSuspendedTools: resumeAutoResume } : {}),
          },
        );
        const resumedChunks: ChunkType[] = [];
        for await (const chunk of resumed.fullStream) resumedChunks.push(chunk);
        expect(seen.answers).toEqual(['first answer']);
        expect(
          resumedChunks.some(
            c => c.type === 'tool-call-suspended' && (c.payload as { toolCallId?: string }).toolCallId === 'call-q2',
          ),
        ).toBe(true);

        const view = await shared.agent.subscribeToThread({ resourceId, threadId });
        onTestFinished(() => view.unsubscribe());
        const requestsWithFollowUp = () =>
          llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

        await shared.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
        if (resumeAutoResume) {
          await vi.waitFor(() => expect(requestsWithFollowUp()).toBeGreaterThan(0), { timeout: 7_000 });
          await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 7_000 });
          return;
        }
        // Long enough for a turn the follow-up started to reach the model. A new Inngest turn takes over a second.
        await new Promise(resolve => setTimeout(resolve, engine === 'inngest' ? 3_000 : 500));
        expect(requestsWithFollowUp()).toBe(0);
        expect(view.activeRunId()).toBe(runId);
        expect(seen.answers).toEqual(['first answer']);
      },
    );

    // Technical: the run's own `autoResumeSuspendedTools` lived only on this process's thread-runtime record. A resume
    // through another Mastra instance (another process, or this one after a restart) has no record, so a resume that
    // omitted the option fell back to the agent's default (on), and once the run parked again a follow-up started a
    // turn the run had turned off. The run's setting is now persisted with each suspension and restored on resume; a
    // resume's explicit option wins and is persisted in turn. On durable and evented, a cold resume restored the
    // setting the run started with rather than the latest one, so an override passed by one instance was lost after
    // the next instance resumed without the option. (#30190)
    // Skipped on Inngest: its harness registers every agent on one shared host Mastra, so it cannot build a second
    // instance with the same agent id. Not yet checked on Inngest.
    const resumeAcrossInstances = async ({
      firstCallAutoResume,
      resumes,
      starts,
      untilIdle = false,
      suspendsWithoutRecord = false,
    }: {
      firstCallAutoResume: boolean | undefined;
      resumes: readonly (boolean | undefined)[];
      starts: boolean;
      untilIdle?: boolean;
      /** Each question suspends where the run's registry entry holds no record of the resume's option. */
      suspendsWithoutRecord?: boolean;
    }) => {
      const ANSWER_FOLLOW_UP = 'Here is my last answer';
      const seen = { answers: [] as string[] };
      const executing: { mastra?: any; runId?: string } = {};
      const askTool = createTool({
        id: 'ask',
        description: 'Asks the user a question',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async ({ question }, context) => {
          if (!context?.agent?.resumeData) {
            // As on an evented worker that did not run the resume: its entry has only the run's start options.
            const entry =
              suspendsWithoutRecord && executing.runId && getRunRegistryEntry(executing.runId, executing.mastra);
            if (entry) delete entry.autoResumeSuspendedTools;
            return context?.agent?.suspend({ message: question });
          }
          seen.answers.push(context.agent.resumeData.answer);
          return { answer: context.agent.resumeData.answer };
        },
      });
      const memory = new MockMemory();
      const agentOptions = {
        tools: { askTool },
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      } as const;
      const shared = await createSharedAgent(getMock(), agentOptions);
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const llm = getMock();
      // Registered first: a turn the follow-up started would answer it.
      llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), { content: 'FOLLOW_UP_TURN' });
      // Each answered question leads to another, which pauses the run again.
      for (let question = 1; question <= resumes.length; question++) {
        llm.on(
          { endpoint: 'chat', toolCallId: `call-q${question}`, hasToolResult: true },
          {
            toolCalls: [
              { id: `call-q${question + 1}`, name: 'ask', arguments: { question: `question ${question + 1}?` } },
            ],
          },
        );
      }

      const first = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Ask me some questions',
        memory,
        threadId,
        resourceId,
        fixtures: mock => {
          mock.onMessage(/some questions/, {
            toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'question 1?' } }],
          });
        },
        collectChunks: true,
        ...(firstCallAutoResume !== undefined ? { autoResumeSuspendedTools: firstCallAutoResume } : {}),
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      const runId = first.output.runId;

      // Each resume runs in a fresh instance on the same storage, after the previous one is done with the run's
      // segment, as a process that stopped would be. It names only the run, its answer, and maybe the option.
      let previous = shared;
      const answers: string[] = [];
      for (const [index, resumeAutoResume] of resumes.entries()) {
        await getRunRegistryEntry(runId, previous.mastra)?.workflowExecution;
        const instance = await createSharedAgentInAnotherProcess(llm, previous, agentOptions);
        Object.assign(executing, { mastra: instance.mastra, runId });
        const answer = `answer ${index + 1}`;
        answers.push(answer);
        const resumed = await instance.agent.resumeStream(
          { answer },
          {
            runId,
            toolCallId: `call-q${index + 1}`,
            ...(resumeAutoResume !== undefined ? { autoResumeSuspendedTools: resumeAutoResume } : {}),
            ...(untilIdle ? { untilIdle: true } : {}),
          },
        );
        const resumedChunks: ChunkType[] = [];
        for await (const chunk of resumed.fullStream) resumedChunks.push(chunk);
        expect(seen.answers).toEqual(answers);
        expect(
          resumedChunks.some(
            c =>
              c.type === 'tool-call-suspended' &&
              (c.payload as { toolCallId?: string }).toolCallId === `call-q${index + 2}`,
          ),
        ).toBe(true);
        previous = instance;
      }

      const view = await previous.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());
      const requestsWithFollowUp = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

      await previous.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
      if (starts) {
        await vi.waitFor(() => expect(requestsWithFollowUp()).toBeGreaterThan(0), { timeout: 7_000 });
        await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 7_000 });
        // The follow-up reached the model once, in one reply turn.
        expect(requestsWithFollowUp()).toBe(1);
        return;
      }
      // Long enough for a turn the follow-up started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsWithFollowUp()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
      expect(seen.answers).toEqual(answers);
    };
    (engine === 'inngest' ? it.skip : it).each([
      { firstCallAutoResume: false, resumes: [undefined], starts: false },
      { firstCallAutoResume: undefined, resumes: [undefined], starts: true },
      { firstCallAutoResume: false, resumes: [true], starts: true },
      { firstCallAutoResume: undefined, resumes: [false], starts: false },
      { firstCallAutoResume: true, resumes: [false, undefined], starts: false },
      { firstCallAutoResume: false, resumes: [true, undefined], starts: true },
    ] as const)(
      'with autoResumeSuspendedTools $firstCallAutoResume on the first call and $resumes on resumes from other Mastra instances, a follow-up after the run pauses again starts a turn: $starts (#30190)',
      resumeAcrossInstances,
    );
    // Technical: a resume with `untilIdle` re-enters resume() through the idle loop with the options it resolved, the
    // agent default merged in. That default read as the resume's own option, so it replaced the run's setting. (#30190)
    (engine === 'inngest' ? it.skip : it).each([
      { firstCallAutoResume: false, resumes: [undefined], starts: false },
      { firstCallAutoResume: true, resumes: [false, undefined], starts: false },
    ] as const)(
      'with autoResumeSuspendedTools $firstCallAutoResume on the first call and $resumes on untilIdle resumes from other Mastra instances, a follow-up after the run pauses again starts a turn: $starts (#30190)',
      row => resumeAcrossInstances({ ...row, untilIdle: true }),
    );
    // Technical: a tool call that suspends persisted the setting from the run's registry entry in the process it ran
    // in, else from the run's start options. On evented, the resumed segment's steps can run on a worker whose entry
    // never saw the resume's option, so the start options' value was persisted and a later resume restored it. (#30190)
    (engine === 'inngest' ? it.skip : it)(
      'keeps the setting a resume passed when the run pauses again in a step whose process has no record of it (#30190)',
      () =>
        resumeAcrossInstances({
          firstCallAutoResume: true,
          resumes: [false, undefined],
          starts: false,
          suspendsWithoutRecord: true,
        }),
    );

    // Technical: two tool calls of one step suspend side by side, and each persists the setting its segment ran with.
    // A resume read the value from the step's own suspend payload, which mirrors only the first suspended call. Once
    // the second call was resumed with an override and suspended again, a resume of the first call from another
    // Mastra instance read the first call's original value, so the run lost the override. The resume now reads the
    // value persisted with the run's most recent suspension. (#30190)
    // Skipped on Inngest: its harness cannot build a second Mastra instance with the same agent id (see above).
    const resumeSiblingsAcrossInstances = async ({
      firstCallAutoResume,
      override,
      starts,
      answerPausesAgain,
    }: {
      firstCallAutoResume: boolean | undefined;
      override: boolean;
      starts: boolean;
      /** Whether answering the second question leads to a follow-up question that pauses that call again. */
      answerPausesAgain: boolean;
    }) => {
      const ANSWER_FOLLOW_UP = 'Here is my answer to both';
      const answered: string[] = [];
      const askTool = createTool({
        id: 'ask',
        description: 'Asks the user a question',
        inputSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async ({ question }, context) => {
          if (context?.agent?.resumeData) {
            answered.push(question);
            if (question === 'b' && !answerPausesAgain) return { answer: context.agent.resumeData.answer };
          }
          // An answer leads to a follow-up question, so the call pauses again.
          return context?.agent?.suspend({ message: question });
        },
      });
      const memory = new MockMemory();
      const agentOptions = {
        tools: { askTool },
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      } as const;
      const shared = await createSharedAgent(getMock(), agentOptions);
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const llm = getMock();
      // Registered first: a turn the follow-up started would answer it.
      llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), { content: 'FOLLOW_UP_TURN' });
      llm.onMessage(/two questions/, {
        toolCalls: [
          { id: 'call-a', name: 'ask', arguments: { question: 'a' } },
          { id: 'call-b', name: 'ask', arguments: { question: 'b' } },
        ],
      });
      const first = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Ask me two questions',
        memory,
        threadId,
        resourceId,
        fixtures: () => {},
        collectChunks: true,
        ...(firstCallAutoResume !== undefined ? { autoResumeSuspendedTools: firstCallAutoResume } : {}),
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      const runId = first.output.runId;

      // The second question is answered first, with the override.
      const resumedB = await shared.agent.resumeStream(
        { answer: 'b' },
        { runId, toolCallId: 'call-b', autoResumeSuspendedTools: override },
      );
      const resumedBChunks: ChunkType[] = [];
      for await (const chunk of resumedB.fullStream) resumedBChunks.push(chunk);
      expect(answered).toEqual(['b']);
      expect(
        resumedBChunks.some(
          c => c.type === 'tool-call-suspended' && (c.payload as { toolCallId?: string }).toolCallId === 'call-b',
        ),
      ).toBe(answerPausesAgain);

      // The first question is answered from a fresh instance on the same storage, without the option.
      await getRunRegistryEntry(runId, shared.mastra)?.workflowExecution;
      const instance = await createSharedAgentInAnotherProcess(llm, shared, agentOptions);
      const resumedA = await instance.agent.resumeStream({ answer: 'a' }, { runId, toolCallId: 'call-a' });
      for await (const _chunk of resumedA.fullStream) {
        // drain
      }
      expect(answered).toEqual(['b', 'a']);

      const view = await instance.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());
      const requestsWithFollowUp = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

      await instance.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
      if (starts) {
        await vi.waitFor(() => expect(requestsWithFollowUp()).toBeGreaterThan(0), { timeout: 7_000 });
        await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 7_000 });
        expect(requestsWithFollowUp()).toBe(1);
        return;
      }
      // Long enough for a turn the follow-up started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsWithFollowUp()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
    };
    (engine === 'inngest' ? it.skip : it).each([
      { firstCallAutoResume: undefined, override: false, starts: false },
      { firstCallAutoResume: false, override: true, starts: true },
    ] as const)(
      'with two questions pending, resuming one with autoResumeSuspendedTools $override keeps that setting after the other is resumed from another Mastra instance: a follow-up starts a turn: $starts (#30190)',
      row => resumeSiblingsAcrossInstances({ ...row, answerPausesAgain: true }),
    );
    // Known limit: the setting is persisted only with a suspension. When the call resumed with the override finishes
    // instead of pausing again, nothing records the override, and a resume from another instance reads the value the
    // other call persisted when it paused. Keeping it needs run-level state in the snapshot. (#30190)
    (engine === 'inngest' ? it.skip : it.fails)(
      'with two questions pending, resuming one with autoResumeSuspendedTools false keeps that setting after it finishes and the other is resumed from another Mastra instance (#30190)',
      () =>
        resumeSiblingsAcrossInstances({
          firstCallAutoResume: undefined,
          override: false,
          starts: false,
          answerPausesAgain: false,
        }),
    );

    // Technical: with no call-level `autoResumeSuspendedTools`, the #30190 release awaits the agent's default
    // options before it starts the follow-up turn. An explicit resume with `autoResumeSuspendedTools: false` can
    // update the same record and park the run again during that await. The record is unchanged, so the release read
    // the default it had awaited (on) and started the turn the run had just turned off. (#30190)
    it('keeps a follow-up queued when an explicit resume turns auto-resume off while the agent defaults still resolve (#30190)', async () => {
      const ANSWER_FOLLOW_UP = 'Here is my queued answer';
      const seen = { answers: [] as string[] };
      const askTool = createTool({
        id: 'ask',
        description: 'Asks the user a question',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async ({ question }, context) => {
          if (!context?.agent?.resumeData) return context?.agent?.suspend({ message: question });
          seen.answers.push(context.agent.resumeData.answer);
          // The answered question leads to another, which parks the run again.
          return context.agent.suspend({ message: 'second?' });
        },
      });
      // Agent defaults that resolve asynchronously, as ones read from a settings store do. Once the follow-up is
      // sent, the next lookup waits until the test lets it answer (auto-resume on).
      let holdNextLookup = false;
      let heldLookups = 0;
      let answerHeldLookup!: () => void;
      const lookupAnswered = new Promise<void>(resolve => (answerHeldLookup = resolve));
      onTestFinished(() => answerHeldLookup());
      const defaultOptions = async () => {
        if (!holdNextLookup) return {};
        holdNextLookup = false;
        heldLookups++;
        await lookupAnswered;
        return { autoResumeSuspendedTools: true };
      };
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), { tools: { askTool }, memory, defaultOptions, engine });
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const llm = getMock();
      // Registered first: a turn the follow-up started would answer it.
      llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), { content: 'FOLLOW_UP_TURN' });

      const first = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Ask me a question',
        memory,
        threadId,
        resourceId,
        fixtures: mock => {
          mock.onMessage(/Ask me a question/, {
            toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'first?' } }],
          });
        },
        collectChunks: true,
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      const runId = first.output.runId;
      const view = await shared.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());
      const requestsWithFollowUp = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

      holdNextLookup = true;
      await shared.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
      await vi.waitFor(() => expect(heldLookups).toBe(1));

      // While the defaults resolve, the user answers through an explicit resume that turns auto-resume off.
      const resumed = await shared.agent.resumeStream(
        { answer: 'first answer' },
        { runId, toolCallId: 'call-q1', autoResumeSuspendedTools: false },
      );
      const resumedChunks: ChunkType[] = [];
      for await (const chunk of resumed.fullStream) resumedChunks.push(chunk);
      expect(seen.answers).toEqual(['first answer']);
      expect(resumedChunks.some(c => c.type === 'tool-call-suspended')).toBe(true);

      answerHeldLookup();
      // Long enough for a turn the follow-up started to reach the model. A new Inngest turn takes over a second.
      await new Promise(resolve => setTimeout(resolve, engine === 'inngest' ? 3_000 : 500));
      expect(requestsWithFollowUp()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
      expect(seen.answers).toEqual(['first answer']);
    });

    // Technical: an explicit resume holds the parked run while it sets up (loads the snapshot, takes the lease back,
    // recalls the thread). A follow-up sent meanwhile is that resumed run's input, as before #30190: releasing the
    // parked run for it would start a turn beside the resumed tool. (#30190)
    (engine === 'inngest' ? it.skip : it)(
      'keeps a follow-up sent while an explicit resume sets up queued for the resumed run (#30190)',
      async () => {
        const ANSWER_FOLLOW_UP = 'Here is a note while you resume';
        const seen = { answers: [] as string[], requestsWhenResumed: -1 };
        const llm = getMock();
        const askTool = createTool({
          id: 'ask',
          description: 'Asks the user a question',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async ({ question }, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({ message: question });
            seen.answers.push(context.agent.resumeData.answer);
            seen.requestsWhenResumed = llm.getRequests().length;
            return { answer: context.agent.resumeData.answer };
          },
        });
        const memory = new MockMemory();
        const shared = await createSharedAgent(llm, {
          tools: { askTool },
          memory,
          defaultOptions: { autoResumeSuspendedTools: true },
          engine,
        });
        const threadId = globalThis.crypto.randomUUID();
        const resourceId = globalThis.crypto.randomUUID();
        llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), { content: 'FOLLOW_UP_SEEN' });
        llm.on({ endpoint: 'chat', toolCallId: 'call-q1', hasToolResult: true }, { content: 'RESUMED_REPLY' });

        const first = await runLoopScenario({
          engine,
          llm,
          sharedAgent: shared,
          prompt: 'Ask me a question',
          memory,
          threadId,
          resourceId,
          fixtures: mock => {
            mock.onMessage(/Ask me a question/, {
              toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'first?' } }],
            });
          },
          collectChunks: true,
        });
        expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
        const runId = first.output.runId;
        const requestsWithFollowUp = () =>
          llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

        // The resume's first storage read waits until the follow-up has been sent.
        const workflows = await shared.mastra.getStorage().getStore('workflows');
        const loadWorkflowSnapshot = workflows.loadWorkflowSnapshot.bind(workflows);
        let resumeReading = false;
        let letResumeRead!: () => void;
        const resumeMayRead = new Promise<void>(resolve => (letResumeRead = resolve));
        onTestFinished(() => letResumeRead());
        vi.spyOn(workflows, 'loadWorkflowSnapshot').mockImplementationOnce(async (...args) => {
          resumeReading = true;
          await resumeMayRead;
          return loadWorkflowSnapshot(...args);
        });
        const resumed = shared.agent.resumeStream({ answer: 'first answer' }, { runId, toolCallId: 'call-q1' });
        await vi.waitFor(() => expect(resumeReading).toBe(true));

        await shared.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
        // Long enough for a turn the follow-up started to reach the model.
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(requestsWithFollowUp()).toBe(0);

        letResumeRead();
        for await (const _chunk of (await resumed).fullStream) {
          // drain
        }
        const view = await shared.agent.subscribeToThread({ resourceId, threadId });
        onTestFinished(() => view.unsubscribe());
        await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 7_000 });
        expect(seen.answers).toEqual(['first answer']);
        // The follow-up reached the model only after the resumed tool ran.
        const firstFollowUpRequest = llm
          .getRequests()
          .findIndex(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP));
        expect(firstFollowUpRequest).toBeGreaterThanOrEqual(seen.requestsWhenResumed);
      },
    );

    // Technical: `resumeGenerate()` on a plain agent runs the resumed tool without registering the run with the thread
    // runtime, so the record parked by the first turn still looked parked. With auto-resume on, a follow-up sent while
    // the resumed tool ran released that record and started a turn beside the tool. (#30190)
    (engine === 'normal' ? it : it.skip)(
      'keeps a follow-up sent while resumeGenerate() runs the resumed tool queued until that tool finishes (#30190)',
      async () => {
        const ANSWER_FOLLOW_UP = 'Here is a note while you resume';
        const seen = { executions: 0, running: 0, maxRunning: 0, requestsWhenResumed: -1 };
        let letResumedToolFinish!: () => void;
        const resumedToolMayFinish = new Promise<void>(resolve => (letResumedToolFinish = resolve));
        onTestFinished(() => letResumedToolFinish());
        const llm = getMock();
        const askTool = createTool({
          id: 'ask',
          description: 'Asks the user a question',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async ({ question }, context) => {
            seen.executions++;
            seen.running++;
            seen.maxRunning = Math.max(seen.maxRunning, seen.running);
            try {
              if (!context?.agent?.resumeData) return await context?.agent?.suspend({ message: question });
              await resumedToolMayFinish;
              seen.requestsWhenResumed = llm.getRequests().length;
              return { answer: context.agent.resumeData.answer };
            } finally {
              seen.running--;
            }
          },
        });
        const memory = new MockMemory();
        const shared = await createSharedAgent(llm, {
          tools: { askTool },
          memory,
          defaultOptions: { autoResumeSuspendedTools: true },
          engine,
        });
        const threadId = globalThis.crypto.randomUUID();
        const resourceId = globalThis.crypto.randomUUID();
        llm.onMessage(new RegExp(ANSWER_FOLLOW_UP), {
          toolCalls: [{ id: 'call-q2', name: 'ask', arguments: { question: 'second?' } }],
        });
        llm.on({ endpoint: 'chat', toolCallId: 'call-q1', hasToolResult: true }, { content: 'RESUMED_REPLY' });

        const first = await runLoopScenario({
          engine,
          llm,
          sharedAgent: shared,
          prompt: 'Ask me a question',
          memory,
          threadId,
          resourceId,
          fixtures: mock => {
            mock.onMessage(/Ask me a question/, {
              toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'first?' } }],
            });
          },
          collectChunks: true,
        });
        expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
        const runId = first.output.runId;
        const requestsWithFollowUp = () =>
          llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP)).length;

        const resumed = shared.agent.resumeGenerate({ answer: 'first answer' }, { runId, toolCallId: 'call-q1' });
        await vi.waitFor(() => expect(seen.running).toBe(1));

        await shared.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;
        // Long enough for a turn the follow-up started to reach the model and call the tool.
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(requestsWithFollowUp()).toBe(0);
        expect(seen.executions).toBe(2);

        letResumedToolFinish();
        await resumed;
        // The follow-up runs once the resumed tool has finished, never beside it.
        await vi.waitFor(() => expect(requestsWithFollowUp()).toBeGreaterThan(0), { timeout: 7_000 });
        await vi.waitFor(() => expect(seen.executions).toBe(3));
        expect(seen.maxRunning).toBe(1);
        const firstFollowUpRequest = llm
          .getRequests()
          .findIndex(request => JSON.stringify(request.body.messages).includes(ANSWER_FOLLOW_UP));
        expect(firstFollowUpRequest).toBeGreaterThanOrEqual(seen.requestsWhenResumed);
      },
    );

    // Technical: `resumeGenerate()` on a plain agent doesn't register its result with the thread runtime, whose record
    // still shows the first suspension and its options. A run that parked again therefore looked answerable, and a
    // follow-up that arrived after the resumed run's last model request started a turn once the resume's hold ended,
    // where before #30190 it stayed queued. (#30190)
    it.skipIf(engine !== 'normal').each([
      {
        parksOn: 'a new tool approval',
        resumeOptions: {},
        next: { id: 'call-d1', name: 'delete-file', arguments: { path: 'notes.txt' } },
      },
      {
        parksOn: 'another question with auto-resume turned off',
        resumeOptions: { autoResumeSuspendedTools: false },
        next: { id: 'call-q2', name: 'ask', arguments: { question: 'second?' } },
      },
    ])(
      'keeps a follow-up sent while resumeGenerate() runs queued when the run parks again on $parksOn (#30190)',
      async ({ resumeOptions, next }) => {
        const ANSWER_FOLLOW_UP = 'Here is a note while you resume';
        const seen = { waiting: 0 };
        let letWaitFinish!: () => void;
        const waitMayFinish = new Promise<void>(resolve => (letWaitFinish = resolve));
        onTestFinished(() => letWaitFinish());
        const llm = getMock();
        const askTool = createTool({
          id: 'ask',
          description: 'Asks the user a question',
          inputSchema: z.object({ question: z.string() }),
          suspendSchema: z.object({ message: z.string() }),
          resumeSchema: z.object({ answer: z.string() }),
          execute: async ({ question }, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({ message: question });
            return { answer: context.agent.resumeData.answer };
          },
        });
        const deleteFileTool = createTool({
          id: 'delete-file',
          description: 'Deletes a file',
          inputSchema: z.object({ path: z.string() }),
          requireApproval: true,
          execute: async ({ path }) => ({ deleted: true, path }),
        });
        // Runs beside the call the run parks on, after the resumed run's last model request.
        const waitTool = createTool({
          id: 'wait',
          description: 'Waits a moment',
          inputSchema: z.object({}),
          execute: async () => {
            seen.waiting++;
            await waitMayFinish;
            return { waited: true };
          },
        });
        const memory = new MockMemory();
        const shared = await createSharedAgent(llm, {
          tools: { askTool, deleteFileTool, waitTool },
          memory,
          defaultOptions: { autoResumeSuspendedTools: true },
          engine,
        });
        const threadId = globalThis.crypto.randomUUID();
        const resourceId = globalThis.crypto.randomUUID();
        llm.on(
          { endpoint: 'chat', toolCallId: 'call-q1', hasToolResult: true },
          { toolCalls: [{ id: 'call-w1', name: 'wait', arguments: {} }, next] },
        );

        const first = await runLoopScenario({
          engine,
          llm,
          sharedAgent: shared,
          prompt: 'Ask me a question',
          memory,
          threadId,
          resourceId,
          fixtures: mock => {
            mock.onMessage(/Ask me a question/, {
              toolCalls: [{ id: 'call-q1', name: 'ask', arguments: { question: 'first?' } }],
            });
          },
          collectChunks: true,
        });
        expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
        const runId = first.output.runId;

        const resumed = shared.agent.resumeGenerate(
          { answer: 'first answer' },
          { runId, toolCallId: 'call-q1', ...resumeOptions },
        );
        await vi.waitFor(() => expect(seen.waiting).toBe(1));
        await shared.agent.sendMessage(ANSWER_FOLLOW_UP, { resourceId, threadId }).accepted;

        letWaitFinish();
        expect((await resumed).finishReason).toBe('suspended');
        const requestsWhenParked = llm.getRequests().length;
        // Long enough for a turn the follow-up started to reach the model.
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(llm.getRequests()).toHaveLength(requestsWhenParked);

        // A follow-up sent once the run parked again waits as well.
        await shared.agent.sendMessage('Another note after it parked', { resourceId, threadId }).accepted;
        await new Promise(resolve => setTimeout(resolve, 500));
        expect(llm.getRequests()).toHaveLength(requestsWhenParked);
      },
    );

    // Technical: the #30190 fix lets a follow-up start the next turn once an auto-resume run has
    // parked on suspend(). An approval suspension is excluded: consent arrives through the
    // approval APIs, so with auto-resume on the follow-up still waits on the parked run, and
    // only runs once the tool is approved. (#30190)
    it('keeps a follow-up queued behind a pending tool approval until the tool is approved, with auto-resume on (#30190)', async () => {
      let deletes = 0;
      const deleteFileTool = createTool({
        id: 'delete-file',
        description: 'Deletes a file',
        inputSchema: z.object({ path: z.string() }),
        requireApproval: true,
        execute: async ({ path }) => {
          deletes++;
          return { deleted: true, path };
        },
      });
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { deleteFileTool },
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      });
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const llm = getMock();
      // Registered first: a turn whose latest user message is the follow-up answers it.
      llm.onMessage(/Also check the backups/, { content: 'FOLLOWUP_REPLY backups are fine' });
      llm.on({ endpoint: 'chat', toolCallId: 'call-del-1', hasToolResult: true }, { content: 'DELETED_REPLY' });

      const first = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Delete the config file',
        memory,
        threadId,
        resourceId,
        fixtures: mock => {
          mock.onMessage(/Delete the config file/, {
            toolCalls: [{ id: 'call-del-1', name: 'delete-file', arguments: { path: '/etc/config.json' } }],
          });
        },
        collectChunks: true,
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-approval')).toBe(true);
      const runId = first.output.runId;

      const view = await shared.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());
      const requestsWithFollowUp = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body.messages).includes('Also check the backups'))
          .length;

      // Studio sends the follow-up while the approval is pending.
      await shared.agent.sendMessage('Also check the backups', { resourceId, threadId }).accepted;
      // Long enough for a turn the follow-up started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsWithFollowUp()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
      expect(deletes).toBe(0);

      const approved = (await shared.agent.approveToolCall({ runId, toolCallId: 'call-del-1' })) as unknown as {
        output?: MastraModelOutput<unknown>;
        fullStream: AsyncIterable<ChunkType>;
      };
      const finishes: ChunkType[] = [];
      for await (const chunk of approved.fullStream) {
        if (chunk.type === 'finish') finishes.push(chunk);
      }

      // The approved run finishes once and the tool runs once.
      expect(finishes).toHaveLength(1);
      expect(deletes).toBe(1);

      // Then the follow-up is handled exactly once: one model request carries it, after the
      // approved tool's result, and the thread holds it and its answer once each.
      const deadline = Date.now() + 10_000;
      let { messages } = await memory.recall({ threadId, resourceId });
      while (!messages.some(m => textOf(m).includes('FOLLOWUP_REPLY')) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
        ({ messages } = await memory.recall({ threadId, resourceId }));
      }
      expect(messages.filter(m => textOf(m).includes('Also check the backups'))).toHaveLength(1);
      expect(messages.filter(m => m.role === 'assistant' && textOf(m).includes('FOLLOWUP_REPLY'))).toHaveLength(1);
      expect(requestsWithFollowUp()).toBe(1);
      const followUpRequest = llm
        .getRequests()
        .find(request => JSON.stringify(request.body.messages).includes('Also check the backups'));
      expect(
        followUpRequest?.body.messages.some(
          (m: { role: string; tool_call_id?: string }) => m.role === 'tool' && m.tool_call_id === 'call-del-1',
        ),
      ).toBe(true);
      expect(deletes).toBe(1);
    });

    // Technical: the model calls a tool that needs approval and a plain tool that calls suspend()
    // in one step. The approval wins: the follow-up waits on the parked run until the approval is
    // answered. The approved run then parks on the plain tool's suspend(), and the follow-up starts
    // the reply turn that auto-resumes it. (#30190)
    it('answers a follow-up once after approving a tool that paused beside a tool waiting for input, with auto-resume on (#30190)', async () => {
      let deletes = 0;
      const seen = { resumes: 0, resumedWith: undefined as string | undefined };
      const deleteFileTool = createTool({
        id: 'delete-file',
        description: 'Deletes a file',
        inputSchema: z.object({ path: z.string() }),
        requireApproval: true,
        execute: async ({ path }) => {
          deletes++;
          return { deleted: true, path };
        },
      });
      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({ query: z.string() }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async (_inputData, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend({ message: 'Which user should I find?' });
          }
          seen.resumes++;
          seen.resumedWith = context.agent.resumeData.name;
          return { name: seen.resumedWith };
        },
      });
      const memory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { deleteFileTool, findUserTool },
        memory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      });
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const llm = getMock();
      // Registered first: once the resumed tool answers, the model replies.
      llm.on({ endpoint: 'chat', toolCallId: 'call-2', hasToolResult: true }, { content: 'FINAL_REPLY Dero Israel' });
      // The follow-up turn re-calls the suspended tool with the answer read from the user's reply.
      llm.onMessage(/The user is Dero Israel/, {
        toolCalls: [
          {
            id: 'call-2',
            name: 'find-user',
            arguments: { query: 'user by name', suspendedToolCallId: 'call-1', resumeData: { name: 'Dero Israel' } },
          },
        ],
      });
      llm.on({ endpoint: 'chat', toolCallId: 'call-del-1', hasToolResult: true }, { content: 'DELETED_REPLY' });

      const first = await runLoopScenario({
        engine,
        llm,
        sharedAgent: shared,
        prompt: 'Delete the config file and find the user named Dero Israel',
        memory,
        threadId,
        resourceId,
        fixtures: mock => {
          mock.onMessage(/Delete the config file/, {
            toolCalls: [
              { id: 'call-del-1', name: 'delete-file', arguments: { path: '/etc/config.json' } },
              { id: 'call-1', name: 'find-user', arguments: { query: 'user by name' } },
            ],
          });
        },
        collectChunks: true,
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-approval')).toBe(true);
      const runId = first.output.runId;

      const view = await shared.agent.subscribeToThread({ resourceId, threadId });
      onTestFinished(() => view.unsubscribe());
      const requestsWithReply = () =>
        llm.getRequests().filter(request => JSON.stringify(request.body?.messages).includes(FOLLOW_UP)).length;

      await shared.agent.sendMessage(FOLLOW_UP, { resourceId, threadId }).accepted;
      // Long enough for a turn the follow-up started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(requestsWithReply()).toBe(0);
      expect(view.activeRunId()).toBe(runId);
      expect(deletes).toBe(0);
      expect(seen.resumes).toBe(0);

      const approved = (await shared.agent.approveToolCall({ runId, toolCallId: 'call-del-1' })) as unknown as {
        fullStream: AsyncIterable<ChunkType>;
      };
      const approvedChunks: ChunkType[] = [];
      for await (const chunk of approved.fullStream) approvedChunks.push(chunk);
      expect(deletes).toBe(1);
      // An approval makes the step run its calls one at a time, so the plain tool only runs, and
      // pauses for its input, once the approved call is done.
      expect(
        approvedChunks.some(chunk => chunk.type === 'tool-call-suspended' && chunk.payload.toolCallId === 'call-1'),
      ).toBe(true);

      const deadline = Date.now() + 5_000;
      let { messages } = await memory.recall({ threadId, resourceId });
      while (!messages.some(m => textOf(m).includes('FINAL_REPLY')) && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
        ({ messages } = await memory.recall({ threadId, resourceId }));
      }
      // Count only once no run holds the thread, so a second turn that started late is caught.
      await vi.waitFor(() => expect(view.activeRunId()).toBeNull(), { timeout: 5_000 });
      ({ messages } = await memory.recall({ threadId, resourceId }));
      expect(messages.filter(m => textOf(m).includes(FOLLOW_UP))).toHaveLength(1);
      expect(
        messages.filter(m => m.role === 'assistant' && textOf(m).includes('FINAL_REPLY Dero Israel')),
      ).toHaveLength(1);
      expect(seen.resumedWith).toBe('Dero Israel');
      expect(seen.resumes).toBe(1);
      expect(requestsWithReply()).toBe(2);
      expect(deletes).toBe(1);
    });

    /** The issue's case: the same workflow run resumes once, and the step before the suspension is not rerun. */
    const expectWorkflowResumedOnce = (seen: Awaited<ReturnType<typeof createStudioThread>>['seen']) => {
      expect(seen.preflightRuns).toBe(1);
      expect(seen.workflowRunIds).toHaveLength(2);
      expect(seen.workflowRunIds[1]).toBe(seen.workflowRunIds[0]);
    };

    // Technical: as above, with a workflow used as a tool whose step calls suspend(). (#30190)
    it('resumes a suspended workflow tool when the reply arrives through sendMessage after it paused (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'workflow',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      await expectReplyHandledOnce();
      expectWorkflowResumedOnce(seen);
    });

    // Technical: the reply is queued while the workflow step is still running; the run then
    // parks on the step's suspend() with the reply still queued. (#30190)
    it('resumes a suspended workflow tool when the reply was sent while the workflow was still running (#30190)', async () => {
      let releaseStep!: () => void;
      const { seen, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'workflow',
        release: new Promise<void>(resolve => (releaseStep = resolve)),
      });

      const first = firstMessage();
      await vi.waitFor(() => expect(seen.entered).toBe(true));
      await sendFollowUp();
      releaseStep();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      await expectReplyHandledOnce();
      expectWorkflowResumedOnce(seen);
    });

    // Technical: the reply reaches the process that holds the parked run as a `signal-enqueued`
    // event from another runtime. That path queued it without the auto-resume check, so the
    // parked run kept the thread and the reply never ran. (#30190)
    // Technical: the claimed owner hands input from a sender that cannot see its run to that
    // run through `#queueForActiveRun`, which queued it onto the parked run. (#30190)
    it('resumes a suspended workflow tool when the reply reaches the claimed thread owner from another runtime (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'workflow',
        replyFrom: 'claimed-owner',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      await expectReplyHandledOnce();
      expectWorkflowResumedOnce(seen);
    });

    it('resumes a suspended workflow tool when the reply is sent from another runtime on the thread (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, expectReplyHandledOnce } = await createStudioThread({
        suspendsIn: 'workflow',
        replyFrom: 'other-runtime',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      await expectReplyHandledOnce();
      expectWorkflowResumedOnce(seen);
    });

    // #26673: the model re-calls a plain tool under a new id and names the original call via
    // `suspendedToolCallId`. The original suspension must be cleared so later turns stop asking
    // the model to resume it.
    it('clears the original suspension when a plain tool is auto-resumed under a new toolCallId', async () => {
      const askUserTool = createTool({
        id: 'ask-user',
        description: 'Asks the user a question',
        inputSchema: z.object({ question: z.string() }),
        suspendSchema: z.object({ question: z.string() }),
        resumeSchema: z.object({ answer: z.string() }),
        execute: async (inputData, context) => {
          if (!context?.agent?.resumeData) {
            return context?.agent?.suspend({ question: inputData.question });
          }
          return { answer: context.agent.resumeData.answer };
        },
      });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { askUserTool },
        memory: sharedMemory,
        defaultOptions: { autoResumeSuspendedTools: true },
        engine,
      });
      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      const first = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Book a room for me',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/book/i, {
            toolCalls: [{ id: 'call-book', name: 'ask-user', arguments: { question: 'Which color?' } }],
          });
        },
        collectChunks: true,
      });
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      // The suspension is saved on the thread, which is what a later turn (or another process)
      // resumes from.
      await vi.waitFor(async () => {
        const { messages } = await sharedMemory.recall({ threadId, resourceId });
        const suspended = messages.flatMap(m => Object.values((m.content.metadata as any)?.suspendedTools ?? {}));
        expect(suspended).toEqual([
          expect.objectContaining({
            toolName: 'ask-user',
            toolCallId: 'call-book',
            suspendPayload: { question: 'Which color?' },
          }),
        ]);
      });

      const second = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Blue please',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call-book-2',
                  name: 'ask-user',
                  arguments: {
                    question: 'Which color?',
                    suspendedToolCallId: 'call-book',
                    resumeData: { answer: 'blue' },
                  },
                },
              ],
            },
          );
          llm.on({ endpoint: 'chat', toolCallId: 'call-book-2', hasToolResult: true }, { content: 'Booked in blue.' });
        },
        collectChunks: true,
      });

      const acks = second.chunks!.filter(c => c.type === 'tool-call-resumed');
      expect(acks.map(c => (c as any).payload.toolCallId)).toEqual(['call-book']);
      const result = second.chunks!.find(c => c.type === 'tool-result') as any;
      expect(result?.payload.result).toEqual({ answer: 'blue' });

      const { messages } = await sharedMemory.recall({ threadId, resourceId });
      const remaining = messages.flatMap(m => Object.keys((m.content.metadata as any)?.suspendedTools ?? {}));
      expect(remaining).toEqual([]);

      const third = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Thanks, anything else?',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on({ endpoint: 'chat' }, { content: 'Nothing else.' });
        },
      });
      const lastRequest = third.requests[third.requests.length - 1];
      const systemText = (lastRequest?.body?.messages ?? [])
        .filter((m: any) => m.role === 'system')
        .map((m: any) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
        .join('\n');
      expect(systemText).not.toContain('suspended tools');
    });

    it('does NOT auto-resume when autoResumeSuspendedTools is false', async () => {
      let toolExecuted = false;

      const deleteFileTool = createTool({
        id: 'delete-file',
        description: 'Deletes a file',
        inputSchema: z.object({
          path: z.string(),
        }),
        requireApproval: true,
        execute: async inputData => {
          toolExecuted = true;
          return { deleted: true, path: inputData.path };
        },
      });

      // Build a shared agent WITHOUT autoResumeSuspendedTools
      const shared = await createSharedAgent(getMock(), {
        tools: { deleteFileTool },
        memory: new MockMemory(),
        defaultOptions: {
          autoResumeSuspendedTools: false,
        },
        engine,
      });

      const threadId = globalThis.crypto.randomUUID();
      const resourceId = globalThis.crypto.randomUUID();

      // First call: tool suspends
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Delete the config file',
        memory: new MockMemory(),
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/delete/i, {
            toolCalls: [
              {
                id: 'call-del-1',
                name: 'delete-file',
                arguments: { path: '/etc/config.json' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: approval chunk emitted
      const approvalChunks = chunks!.filter(c => c.type === 'tool-call-approval');
      expect(approvalChunks.length).toBeGreaterThan(0);
      expect(toolExecuted).toBe(false);

      // Second call: user says "approve" but auto-resume is disabled
      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Yes, go ahead',
        memory: new MockMemory(),
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/yes|approve/i, {
            content:
              'I understand you want to delete the config file. Please use the approveToolCall API to approve it.',
          });
        },
      });

      // Assert: tool was NOT auto-resumed (remains suspended)
      expect(toolExecuted).toBe(false);
    });
  },
  { skip: ['fs'] },
);
