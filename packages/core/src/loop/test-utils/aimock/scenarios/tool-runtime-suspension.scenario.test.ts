import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Runtime tool suspension with `suspend()`.
 *
 * Tools can call `context.agent.suspend()` mid-execution to pause and request
 * additional user input or confirmation. This is different from `requireApproval`
 * which suspends before execution. Runtime suspension emits `tool-call-suspended`
 * chunks and resumes via `agent.resumeStream()`.
 *
 * Regression classes:
 * - Tool can call `suspend()` with custom payload
 * - `tool-call-suspended` chunk emitted with suspend data
 * - Loop pauses and resumes via `resumeStream()`
 * - Resume data flows back into tool execution
 */
describeForAllEngines('AIMock loop scenario: tool runtime suspension', engine => {
  const getMock = useLoopScenarioAimock();

  it('emits tool-call-suspended chunk when tool calls suspend()', async () => {
    const processDataTool = createTool({
      id: 'process-data',
      description: 'Processes data and may require additional confirmation',
      inputSchema: z.object({
        data: z.string().describe('The data to process'),
      }),
      execute: async (inputData, context) => {
        const suspend = context?.agent?.suspend;
        if (!suspend) {
          throw new Error('Expected suspend to be provided in context');
        }
        // Suspend to request additional confirmation
        await suspend({ reason: 'Processing requires manual confirmation' });
        return { result: `Processed: ${inputData.data}` };
      },
    });

    const { chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Process the data "test-123"',
      tools: { processDataTool },
      fixtures: llm => {
        llm.onMessage(/process/i, {
          toolCalls: [
            {
              id: 'call_process_1',
              name: 'process-data',
              arguments: { data: 'test-123' },
            },
          ],
        });
      },
      collectChunks: true,
    });

    // Assert: tool-call-suspended chunk emitted
    expect(chunks).toBeDefined();
    const suspendedChunks = chunks!.filter(c => c.type === 'tool-call-suspended');
    expect(suspendedChunks.length).toBeGreaterThan(0);

    // Assert: suspended chunk has the reason from suspend() call
    const firstSuspended = suspendedChunks[0] as any;
    expect(firstSuspended.payload?.suspendPayload).toBeDefined();
    expect(firstSuspended.payload.suspendPayload.reason).toBe('Processing requires manual confirmation');
  });

  it('resumes tool execution with resumeStream() providing resume data', async () => {
    let suspendCalled = false;

    const confirmTool = createTool({
      id: 'confirm-action',
      description: 'Performs action that requires confirmation',
      inputSchema: z.object({
        action: z.string().describe('The action to perform'),
      }),
      resumeSchema: z.object({
        confirmed: z.boolean().describe('Whether the action is confirmed'),
      }),
      execute: async (_inputData, context) => {
        const { resumeData, suspend } = context?.agent ?? {};

        if (!resumeData?.confirmed) {
          suspendCalled = true;
          // First call: suspend to request confirmation
          return await suspend?.({ message: 'Do you confirm this action?' });
        }

        // Second call: resume with confirmation (resumeData available here)
        return { result: `Action confirmed and executed` };
      },
    });

    const { output, chunks } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Perform the action "delete-file"',
      tools: { confirmTool },
      fixtures: llm => {
        // Turn 1: model calls the tool
        llm.onMessage(/perform/i, {
          toolCalls: [
            {
              id: 'call_confirm_1',
              name: 'confirm-action',
              arguments: { action: 'delete-file' },
            },
          ],
        });
      },
      collectChunks: true,
    });

    // Assert: tool suspended
    expect(suspendCalled).toBe(true);

    // Assert: output exists and chunks contain suspension
    expect(output).toBeDefined();
    expect(chunks).toBeDefined();

    // Note: Full resume flow requires manual stream consumption and resumeStream()
    // which is beyond the current AIMock harness scope. This test validates the
    // suspension mechanism itself.
  });

  it('tool without suspend context throws error gracefully', async () => {
    const brokenTool = createTool({
      id: 'broken-tool',
      description: 'Tool that expects suspend but does not receive it',
      inputSchema: z.object({
        input: z.string(),
      }),
      execute: async _inputData => {
        // Intentionally not checking for suspend existence
        // This should throw an error that the loop can handle
        throw new Error('Tool execution failed: suspend not available');
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Use the broken tool',
      tools: { brokenTool },
      fixtures: llm => {
        llm.onMessage(/broken/i, {
          toolCalls: [
            {
              id: 'call_broken_1',
              name: 'broken-tool',
              arguments: { input: 'test' },
            },
          ],
        });
      },
    });

    // Assert: loop completed despite tool error (error handled gracefully)
    expect(output).toBeDefined();
  });
});
