import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

/**
 * A workflow delegation tool must never adopt a model-supplied `suspendedToolRunId`
 * on a fresh (non-resume) call.
 *
 * The optional `suspendedToolRunId` schema field exists so auto-resume can route a
 * resume back to the suspended run — but the model authors it, and some models emit
 * the literal string "null" for it on fresh calls. "null" is truthy, so it used to
 * defeat the `randomUUID()` fallback: two independent calls then shared one cached
 * Run instance keyed by runId "null", and one request was silently lost. A model can
 * also echo a stale-but-valid-looking run id from earlier conversation turns, which
 * collides the same way. Fresh calls must always get a unique run id; a supplied id
 * is only honored alongside resumeData.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/23739
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createTwoCallModel(inputs: { toolCallId: string; input: Record<string, unknown> }[]) {
  return new MockLanguageModelV2({
    doGenerate: async options => {
      const hasToolResult = JSON.stringify(options.prompt).includes('"type":"tool-result"');
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: hasToolResult ? ('stop' as const) : ('tool-calls' as const),
        usage,
        content: hasToolResult
          ? [{ type: 'text' as const, text: 'Both workflows completed.' }]
          : inputs.map(({ toolCallId, input }) => ({
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'workflow-ticketWorkflow',
              input: JSON.stringify(input),
            })),
      };
    },
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
            ...inputs.map(({ toolCallId, input }) => ({
              type: 'tool-call' as const,
              toolCallId,
              toolName: 'workflow-ticketWorkflow',
              input: JSON.stringify(input),
            })),
            { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
          ];

      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(parts as any[]),
      };
    },
  });
}

function setup(inputs: { toolCallId: string; input: Record<string, unknown> }[]) {
  const completedTickets: string[] = [];
  const schema = z.object({ ticket: z.string() });
  const step = createStep({
    id: 'ticket-step',
    inputSchema: schema,
    outputSchema: schema,
    execute: async ({ inputData }) => {
      completedTickets.push(inputData.ticket);
      return { ticket: inputData.ticket };
    },
  });
  const ticketWorkflow = createWorkflow({
    id: 'ticket-workflow',
    inputSchema: schema,
    outputSchema: schema,
  })
    .then(step)
    .commit();

  const createRunSpy = vi.spyOn(ticketWorkflow, 'createRun');

  const agent = new Agent({
    id: 'workflow-run-id-agent',
    name: 'Workflow Run Id Agent',
    instructions: 'Run the ticket workflow for every ticket.',
    model: createTwoCallModel(inputs),
    workflows: { ticketWorkflow },
  });
  const mastra = new Mastra({
    agents: { agent },
    workflows: { ticketWorkflow },
    storage: new InMemoryStore(),
    logger: false,
  });

  return { agent: mastra.getAgent('agent'), createRunSpy, completedTickets };
}

describe('workflow tool with model-supplied suspendedToolRunId on fresh calls', () => {
  it('drops the "null" sentinel so both calls get unique run ids and both complete', async () => {
    const { agent, createRunSpy, completedTickets } = setup([
      { toolCallId: 'call-a', input: { inputData: { ticket: 'A' }, suspendedToolRunId: 'null' } },
      { toolCallId: 'call-b', input: { inputData: { ticket: 'B' } } },
    ]);

    await agent.generate('Run ticket A and ticket B.', { maxSteps: 3 });

    expect(createRunSpy).toHaveBeenCalledTimes(2);
    const runIds = createRunSpy.mock.calls.map(call => call[0]?.runId);
    expect(runIds[0]).toBeTruthy();
    expect(runIds[1]).toBeTruthy();
    expect(runIds[0]).not.toBe(runIds[1]);
    expect(runIds).not.toContain('null');
    expect(completedTickets.sort()).toEqual(['A', 'B']);
  });

  it('ignores an echoed stale run id on fresh calls so both calls get unique run ids', async () => {
    const { agent, createRunSpy, completedTickets } = setup([
      { toolCallId: 'call-a', input: { inputData: { ticket: 'A' }, suspendedToolRunId: 'stale-run-id' } },
      { toolCallId: 'call-b', input: { inputData: { ticket: 'B' }, suspendedToolRunId: 'stale-run-id' } },
    ]);

    await agent.generate('Run ticket A and ticket B.', { maxSteps: 3 });

    expect(createRunSpy).toHaveBeenCalledTimes(2);
    const runIds = createRunSpy.mock.calls.map(call => call[0]?.runId);
    expect(runIds[0]).toBeTruthy();
    expect(runIds[1]).toBeTruthy();
    expect(runIds[0]).not.toBe(runIds[1]);
    expect(runIds).not.toContain('stale-run-id');
    expect(completedTickets.sort()).toEqual(['A', 'B']);
  });
});
