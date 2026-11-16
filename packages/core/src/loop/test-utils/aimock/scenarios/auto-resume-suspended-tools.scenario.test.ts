import { expect, it, onTestFinished, vi } from 'vitest';
import { z } from 'zod/v4';
import { AgentThreadStreamRuntime } from '../../../../agent/thread-stream-runtime';
import { MockMemory } from '../../../../memory';
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
     */
    async function createStudioThread({
      suspendsIn,
      release = Promise.resolve(),
      replyFrom = 'same-runtime',
      sibling,
    }: {
      suspendsIn: 'tool' | 'workflow';
      release?: Promise<void>;
      replyFrom?: 'same-runtime' | 'other-runtime' | 'claimed-owner';
      sibling?: { release: Promise<void> };
    }) {
      const seen = {
        entered: false,
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
          .filter(request => JSON.stringify(request.body.messages).includes('The user is Dero Israel')).length;
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
            return context?.agent?.suspend({ message: 'Which user should I find?' });
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
        });
      const sendFollowUp = async () => {
        if (replyFrom === 'claimed-owner') {
          const claim = await shared.agent.claimThreadOwnership({ resourceId, threadId });
          onTestFinished(() => claim.unsubscribe());
          return otherRuntime.sendSignal(
            shared.agent,
            { type: 'user-message', contents: 'The user is Dero Israel' },
            { resourceId, threadId, ifIdle: { behavior: 'wake', requireClaimedOwner: true } },
            shared.mastra.pubsub,
          ).accepted;
        }
        if (!otherView) return shared.agent.sendMessage('The user is Dero Israel', { resourceId, threadId }).accepted;
        // The other runtime only sees the run through the thread's pubsub.
        const runId = await vi.waitFor(() => {
          const active = otherView.activeRunId();
          if (active === null) throw new Error('The other runtime has not seen the run on the thread yet');
          return active;
        });
        return otherRuntime.sendMessage(
          shared.agent,
          'The user is Dero Israel',
          { resourceId, threadId, runId },
          shared.mastra.pubsub,
        ).accepted;
      };
      const threadAfterReply = async () => {
        const deadline = Date.now() + 10_000;
        let { messages } = await memory.recall({ threadId, resourceId });
        while (!JSON.stringify(messages).includes('FINAL_REPLY') && Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 50));
          ({ messages } = await memory.recall({ threadId, resourceId }));
        }
        return JSON.stringify(messages);
      };
      return { seen, llm, firstMessage, sendFollowUp, threadAfterReply };
    }

    // Technical: the runtime treated the run parked on the tool's suspend() as the thread's
    // active run and queued the follow-up onto it, answering `deliver`; a parked run never
    // drains its queue, so no next turn ran and auto-resume never fired. (#30190)
    it('auto-resumes a suspended tool when the follow-up arrives through sendMessage, as Studio sends it (#30190)', async () => {
      const { seen, llm, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'tool',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      // The follow-up is saved to the thread, the suspended tool resumes with the user's
      // answer, and the final reply lands in the same thread.
      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(seen.resumedWith).toBe('Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
      // The model saw the follow-up in the turn that resumed the tool.
      expect(JSON.stringify(llm.getRequests().at(-2)?.body.messages)).toContain('The user is Dero Israel');
    });

    // Technical: a follow-up sent while the tool is still running is queued for the run's next
    // step, but the run then parks on suspend() and never takes another step. (#30190)
    it('auto-resumes with a follow-up sent while the tool was still running, once the tool suspends (#30190)', async () => {
      let releaseTool!: () => void;
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'tool',
        release: new Promise<void>(resolve => (releaseTool = resolve)),
      });

      const first = firstMessage();
      await vi.waitFor(() => expect(seen.entered).toBe(true));
      await sendFollowUp();
      releaseTool();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(seen.resumedWith).toBe('Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
    });

    // Technical: a step that raises a suspension ends its segment while a sibling tool call of
    // that step still runs. The run counts as parked from then on, so the reply released the
    // thread and the next turn ran beside the sibling call. The reply has to wait until the
    // run's steps settle. (#30190)
    it('starts the reply turn only after a sibling tool call of the suspended step has finished (#30190)', async () => {
      let releaseSibling!: () => void;
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'tool',
        sibling: { release: new Promise<void>(resolve => (releaseSibling = resolve)) },
      });

      const first = firstMessage();
      await vi.waitFor(() => {
        expect(seen.entered).toBe(true);
        expect(seen.siblingStarted).toBe(true);
      });
      // Let the suspension land while the sibling still runs.
      await new Promise(resolve => setTimeout(resolve, 200));
      await sendFollowUp();
      // Long enough for a turn the reply started to reach the model.
      await new Promise(resolve => setTimeout(resolve, 300));
      releaseSibling();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      const thread = await threadAfterReply();
      expect(seen.siblingFinished).toBe(true);
      expect(seen.replyRequestsWhileSiblingRan).toBe(0);
      expect(thread).toContain('The user is Dero Israel');
      expect(seen.resumedWith).toBe('Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
    });

    /** The issue's case: the same workflow run resumes once, and the step before the suspension is not rerun. */
    const expectWorkflowResumedOnce = (seen: Awaited<ReturnType<typeof createStudioThread>>['seen']) => {
      expect(seen.resumedWith).toBe('Dero Israel');
      expect(seen.resumes).toBe(1);
      expect(seen.preflightRuns).toBe(1);
      expect(seen.workflowRunIds).toHaveLength(2);
      expect(seen.workflowRunIds[1]).toBe(seen.workflowRunIds[0]);
    };

    // Technical: as above, with a workflow used as a tool whose step calls suspend(). (#30190)
    it('resumes a suspended workflow tool when the reply arrives through sendMessage after it paused (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'workflow',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
      expectWorkflowResumedOnce(seen);
    });

    // Technical: the reply is queued while the workflow step is still running; the run then
    // parks on the step's suspend() with the reply still queued. (#30190)
    it('resumes a suspended workflow tool when the reply was sent while the workflow was still running (#30190)', async () => {
      let releaseStep!: () => void;
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'workflow',
        release: new Promise<void>(resolve => (releaseStep = resolve)),
      });

      const first = firstMessage();
      await vi.waitFor(() => expect(seen.entered).toBe(true));
      await sendFollowUp();
      releaseStep();
      expect((await first).chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);

      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
      expectWorkflowResumedOnce(seen);
    });

    // Technical: the reply reaches the process that holds the parked run as a `signal-enqueued`
    // event from another runtime. That path queued it without the auto-resume check, so the
    // parked run kept the thread and the reply never ran. (#30190)
    // Technical: the claimed owner hands input from a sender that cannot see its run to that
    // run through `#queueForActiveRun`, which queued it onto the parked run. (#30190)
    it('resumes a suspended workflow tool when the reply reaches the claimed thread owner from another runtime (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'workflow',
        replyFrom: 'claimed-owner',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
      expectWorkflowResumedOnce(seen);
    });

    it('resumes a suspended workflow tool when the reply is sent from another runtime on the thread (#30190)', async () => {
      const { seen, firstMessage, sendFollowUp, threadAfterReply } = await createStudioThread({
        suspendsIn: 'workflow',
        replyFrom: 'other-runtime',
      });

      const first = await firstMessage();
      expect(first.chunks!.some(c => c.type === 'tool-call-suspended')).toBe(true);
      await sendFollowUp();

      const thread = await threadAfterReply();
      expect(thread).toContain('The user is Dero Israel');
      expect(thread).toContain('FINAL_REPLY Dero Israel');
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
