import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { randomUUID } from 'node:crypto';

/**
 * Automatic tool resumption with `autoResumeSuspendedTools`.
 *
 * When a tool has `requireApproval: true` and the agent has
 * `defaultOptions: { autoResumeSuspendedTools: true }`, the agent will
 * automatically resume a suspended tool on the next user message in the
 * same thread. The second call to `agent.stream()` on the same agent+memory
 * detects the suspended state and auto-resumes.
 *
 * Regression classes:
 * - Tool with `requireApproval: true` emits `tool-call-approval` chunk
 * - `autoResumeSuspendedTools` detects suspended tool in memory on next call
 * - Approval gates never accept a model-authored `resumeData: { approved: true }`
 * - A plain `suspend()` tool still auto-resumes from model-authored resumeData
 */
describeForAllEngines(
  'AIMock loop scenario: autoResumeSuspendedTools',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('does not let the model approve its own suspended approval-gated tool call', async () => {
      let toolExecuted = false;
      let toolInputName = '';

      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({
          name: z.string(),
        }),
        requireApproval: true,
        execute: async inputData => {
          toolExecuted = true;
          toolInputName = inputData.name;
          return { name: inputData.name, email: `${inputData.name.toLowerCase()}@test.com` };
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

      const threadId = randomUUID();
      const resourceId = randomUUID();

      // First call: model calls the tool, loop suspends for approval
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
                arguments: { name: 'Dero Israel' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: tool-call-approval chunk emitted (tool suspended)
      const approvalChunks = chunks!.filter(c => c.type === 'tool-call-approval');
      expect(approvalChunks.length).toBeGreaterThan(0);

      // Tool should NOT have executed yet (suspended before execution)
      expect(toolExecuted).toBe(false);

      const { chunks: secondCallChunks, requests: secondCallRequests } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Yes, approve it',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call-2',
                  name: 'find-user',
                  arguments: { name: 'Dero Israel', resumeData: { approved: true } },
                },
              ],
            },
          );
        },
        collectChunks: true,
      });

      // AIMock captures ALL requests across calls; the second call's first request is at index 1
      // (index 0 is from the first call which had no suspended tools yet)
      const secondCallFirstRequest = secondCallRequests[1];
      const systemMessage = secondCallFirstRequest?.body?.messages?.find((m: any) => m.role === 'system');
      expect(systemMessage?.content).toContain('suspended tools');

      expect(toolExecuted).toBe(false);
      expect(toolInputName).toBe('');
      expect(secondCallChunks!.filter(c => c.type === 'tool-call-approval').length).toBeGreaterThan(0);
    });

    it('auto-resumes a plain suspension that is not gated by approval', async () => {
      let resumedCity = '';

      const weatherTool = createTool({
        id: 'weather',
        description: 'Fetches weather for a city',
        inputSchema: z.object({ city: z.string().optional() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ city: z.string() }),
        execute: async (_input, context) => {
          const resumeData = context?.agent?.resumeData as { city?: string } | undefined;
          if (!resumeData?.city) {
            await context?.agent?.suspend?.({ message: 'Which city?' });
            return { weather: 'unknown' };
          }
          resumedCity = resumeData.city;
          return { weather: `${resumeData.city}: sunny` };
        },
      });

      const sharedMemory = new MockMemory();
      const shared = await createSharedAgent(getMock(), {
        tools: { weatherTool },
        memory: sharedMemory,
        defaultOptions: {
          autoResumeSuspendedTools: true,
        },
        engine,
      });

      const threadId = randomUUID();
      const resourceId = randomUUID();

      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'What is the weather?',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.onMessage(/weather/i, {
            toolCalls: [{ id: 'w-1', name: 'weather', arguments: {} }],
          });
        },
        collectChunks: true,
      });

      expect(chunks!.filter(c => c.type === 'tool-call-suspended').length).toBeGreaterThan(0);
      expect(resumedCity).toBe('');

      await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Paris',
        memory: sharedMemory,
        threadId,
        resourceId,
        fixtures: llm => {
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [{ id: 'w-2', name: 'weather', arguments: { resumeData: { city: 'Paris' } } }],
            },
          );
          llm.on({ endpoint: 'chat', toolCallId: 'w-2', hasToolResult: true }, { content: 'Paris: sunny' });
        },
      });

      expect(resumedCity).toBe('Paris');
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

      const threadId = randomUUID();
      const resourceId = randomUUID();

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
