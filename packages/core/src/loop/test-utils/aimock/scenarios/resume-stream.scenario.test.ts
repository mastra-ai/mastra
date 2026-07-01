import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../../../memory';
import { createTool } from '../../../../tools';
import { createSharedAgent, runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Manual tool resumption with `resumeStream()`.
 *
 * When a tool calls `suspend()` to pause execution, the user can manually
 * resume by calling `agent.resumeStream(resumeData, { runId })`. The tool
 * receives the `resumeData` via `context.agent.resumeData` on the second
 * execution and continues.
 *
 * This differs from `requireApproval` (which suspends before execution and
 * auto-resumes with `{ approved: true }`). Runtime suspension via `suspend()`
 * suspends mid-execution and requires explicit resume data from the user.
 *
 * Regression classes:
 * - Tool calls `suspend()` mid-execution, emits `tool-call-suspended` chunk
 * - `agent.resumeStream(data, { runId })` resumes the suspended tool
 * - Tool receives `resumeData` via `context.agent.resumeData` on second call
 * - Final output reflects the resumed tool's result
 */
describeForAllEngines(
  'AIMock loop scenario: resumeStream() with resumeData',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('resumes a suspended tool when resumeStream() is called with resume data', async () => {
      let suspendCalled = false;
      let resumeDataReceived: string | undefined;

      const findUserTool = createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({
          query: z.string().describe('Search query'),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          name: z.string(),
        }),
        execute: async (_inputData, context) => {
          if (!context?.agent?.resumeData) {
            suspendCalled = true;
            return await context?.agent?.suspend({ message: 'Please provide the name of the user' });
          }
          resumeDataReceived = context.agent.resumeData?.name;
          return {
            name: context.agent.resumeData.name,
            email: `${context.agent.resumeData.name.toLowerCase()}@test.com`,
          };
        },
      });

      const shared = await createSharedAgent(getMock(), {
        tools: { findUserTool },
        memory: new MockMemory(),
      });

      // First call: model calls the tool, tool suspends
      const { output, chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Find the user Dero Israel',
        memory: new MockMemory(),
        threadId: 'test-thread',
        resourceId: 'test-resource',
        fixtures: llm => {
          llm.onMessage(/find/i, {
            toolCalls: [
              {
                id: 'call-1',
                name: 'find-user',
                arguments: { query: 'Dero Israel' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: tool-call-suspended chunk emitted
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);
      expect(suspendCalled).toBe(true);
      expect(resumeDataReceived).toBeUndefined();

      // Resume: call agent.resumeStream with the runId and resume data
      const resumeOutput = await shared.agent.resumeStream({ name: 'Dero Israel' }, { runId: output.runId });

      // Consume the resume stream
      for await (const _chunk of resumeOutput.fullStream) {
        // drain
      }

      // Assert: tool received the resume data
      expect(resumeDataReceived).toBe('Dero Israel');

      // Assert: tool results contain the user data
      const toolResults = await resumeOutput.toolResults;
      const findUserResult = toolResults?.find((r: any) => r.payload.toolName === 'find-user');
      expect(findUserResult).toBeDefined();
      const result = findUserResult?.payload.result as { name: string; email: string };
      expect(result.name).toBe('Dero Israel');
      expect(result.email).toBe('dero israel@test.com');
    });

    it('does not resume when resumeStream() is never called (tool remains suspended)', async () => {
      let suspendCalled = false;
      let toolCompleted = false;

      const editTool = createTool({
        id: 'edit-file',
        description: 'Edits a file with confirmation',
        inputSchema: z.object({
          path: z.string(),
        }),
        suspendSchema: z.object({
          message: z.string(),
        }),
        resumeSchema: z.object({
          confirmed: z.boolean(),
        }),
        execute: async (inputData, context) => {
          if (!context?.agent?.resumeData) {
            suspendCalled = true;
            return await context?.agent?.suspend({ message: 'Are you sure you want to edit this file?' });
          }
          toolCompleted = true;
          return { edited: true, path: inputData.path };
        },
      });

      const shared = await createSharedAgent(getMock(), {
        tools: { editTool },
        memory: new MockMemory(),
      });

      // First call: tool suspends
      const { chunks } = await runLoopScenario({
        engine,
        llm: getMock(),
        sharedAgent: shared,
        prompt: 'Edit the config file',
        memory: new MockMemory(),
        threadId: 'test-thread-2',
        resourceId: 'test-resource',
        fixtures: llm => {
          llm.onMessage(/edit/i, {
            toolCalls: [
              {
                id: 'call-edit-1',
                name: 'edit-file',
                arguments: { path: '/etc/config.json' },
              },
            ],
          });
        },
        collectChunks: true,
      });

      // Assert: tool suspended
      expect(suspendCalled).toBe(true);
      const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
      expect(suspendedChunks.length).toBeGreaterThan(0);

      // Do NOT call resumeStream - tool remains suspended
      // Assert: tool never completed
      expect(toolCompleted).toBe(false);
    });
  },
  { skip: ['durable', 'fs'] },
);
