import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

/**
 * A model that issues two calls to the SAME workflow tool in one step, both
 * carrying whatever `suspendedToolRunId` value the case under test chooses.
 *
 * The run cache (`Workflow.#runs`) is an instance field keyed by run id, so two
 * calls must hit the same workflow tool to collide: a malformed value (the
 * literal string `"null"`) makes both calls resolve to one cached `Run`, and one
 * request is silently lost.
 */
function createTwoCallSameWorkflowModel(suspendedToolRunId: unknown) {
  const toolCallInput = (ticket: string) =>
    JSON.stringify({
      inputData: { ticket },
      ...(suspendedToolRunId === undefined ? {} : { suspendedToolRunId }),
    });

  return new MockLanguageModelV2({
    doStream: async options => {
      const hasToolResult = JSON.stringify(options.prompt).includes('"type":"tool-result"');
      const parts = hasToolResult
        ? [
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'final-response',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            { type: 'text-start' as const, id: 'final-text' },
            { type: 'text-delta' as const, id: 'final-text', delta: 'Both workflows completed.' },
            { type: 'text-end' as const, id: 'final-text' },
            { type: 'finish' as const, finishReason: 'stop' as const, usage },
          ]
        : [
            { type: 'stream-start' as const, warnings: [] },
            {
              type: 'response-metadata' as const,
              id: 'tool-call-response',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-supplied-run-id-a',
              toolName: 'workflow-sharedWorkflow',
              input: toolCallInput('A'),
            },
            {
              type: 'tool-call' as const,
              toolCallId: 'call-supplied-run-id-b',
              toolName: 'workflow-sharedWorkflow',
              input: toolCallInput('B'),
            },
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(parts),
      };
    },
  });
}

function createCompletingWorkflow() {
  const step = createStep({
    id: 'shared-workflow-step',
    inputSchema: z.object({ ticket: z.string() }),
    outputSchema: z.object({ ticket: z.string(), completed: z.boolean() }),
    execute: async ({ inputData }) => ({ ticket: inputData.ticket, completed: true }),
  });

  return createWorkflow({
    id: 'sharedWorkflow',
    inputSchema: z.object({ ticket: z.string() }),
    outputSchema: z.object({ ticket: z.string(), completed: z.boolean() }),
  })
    .then(step)
    .commit();
}

type RunIdProbe = { runIds: string[]; distinct: number };

async function runTwoCallsToSameWorkflow(suspendedToolRunId: unknown): Promise<RunIdProbe> {
  const sharedWorkflow = createCompletingWorkflow();
  const createRun = vi.spyOn(sharedWorkflow, 'createRun');

  const agent = new Agent({
    id: 'supplied-run-id-agent',
    name: 'Supplied Run Id Agent',
    instructions: 'Run the workflow twice.',
    model: createTwoCallSameWorkflowModel(suspendedToolRunId),
    workflows: { sharedWorkflow },
  });

  const mastra = new Mastra({
    agents: { agent },
    workflows: { sharedWorkflow },
    logger: false,
  });

  const stream = await mastra.getAgent('agent').stream('Run the shared workflow twice.', { maxSteps: 6 });
  // Drain the stream so both tool calls execute before the probe is read.
  for await (const _chunk of stream.fullStream) {
    // no-op
  }

  const runIds = createRun.mock.calls
    .map(call => call[0]?.runId)
    .filter((runId): runId is string => typeof runId === 'string');

  // Both independent calls must have reached createRun.
  expect(createRun).toHaveBeenCalledTimes(2);

  return { runIds, distinct: new Set(runIds).size };
}

describe('workflow tool model-supplied suspendedToolRunId', () => {
  it('does not adopt the literal string "null" as a run id', async () => {
    const { runIds, distinct } = await runTwoCallsToSameWorkflow('null');

    expect(runIds).toHaveLength(2);
    expect(runIds).not.toContain('null');
    expect(distinct).toBe(2);
  });

  it('keeps independent calls independent when the field is omitted', async () => {
    const { runIds, distinct } = await runTwoCallsToSameWorkflow(undefined);

    expect(runIds).toHaveLength(2);
    expect(distinct).toBe(2);
  });
});
