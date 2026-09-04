import { expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { randomUUID } from 'node:crypto';

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

      const threadId = randomUUID();
      const resourceId = randomUUID();

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
