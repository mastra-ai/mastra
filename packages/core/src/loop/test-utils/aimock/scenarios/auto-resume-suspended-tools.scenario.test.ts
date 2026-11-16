import { expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod/v4';
import { AgentThreadStreamRuntime } from '../../../../agent/thread-stream-runtime';
import type { PubSub } from '../../../../events/pubsub';
import { MockMemory } from '../../../../memory';
import type { MastraModelOutput } from '../../../../stream/base/output';
import type { ChunkType } from '../../../../stream/types';
import { createTool } from '../../../../tools';
import { createStep, createWorkflow } from '../../../../workflows';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

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
    const itFailsOnEvented = engine === 'evented' ? it.fails : it;

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
      // Long enough for a turn the reply started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 300));
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
    // Evented asks for approval of the plain tool once the approved call has run, so the run parks
    // on an approval again and the follow-up keeps waiting. Cause not yet investigated.
    itFailsOnEvented(
      'answers a follow-up once after approving a tool that paused beside a tool waiting for input, with auto-resume on (#30190)',
      async () => {
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
      },
    );

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
