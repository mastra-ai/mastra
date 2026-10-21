import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const RESUMES = 4;

function toolCallStream(id: string, toolName: string) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
      { type: 'tool-call', toolCallId: id, toolName, input: '{"orderId":"1"}', providerExecuted: false },
      { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
    ]),
  };
}

async function drain(stream: any) {
  let toolCallId: string | undefined;
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'tool-call-approval') toolCallId = chunk.payload.toolCallId;
  }
  return toolCallId;
}

describe('resumed streams open a step boundary (#26475)', () => {
  it('keeps each buffered step to its own tool call across approvals', async () => {
    let call = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        call++;
        return call === 1 ? toolCallStream('call-lookup', 'lookup') : toolCallStream(`call-refund-${call}`, 'refund');
      },
    });
    const agent = new Agent({
      id: 'resume-boundary',
      name: 'resume-boundary',
      instructions: 'support',
      model,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'look up',
          inputSchema: z.object({ orderId: z.string() }),
          execute: async () => ({ ok: true }),
        }),
        refund: createTool({
          id: 'refund',
          description: 'refund',
          inputSchema: z.object({ orderId: z.string() }),
          requireApproval: true,
          execute: async () => ({ refunded: true }),
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false });
    const a = mastra.getAgent('agent');
    const workflows = (await mastra.getStorage()!.getStore('workflows'))!;

    const first = await a.stream('refund', { maxSteps: 20 });
    let toolCallId = await drain(first);
    const runId = first.runId;
    const expectedIds = ['call-lookup'];

    for (let i = 0; i < RESUMES; i++) {
      expect(toolCallId).toBeDefined();
      expectedIds.push(toolCallId!);
      toolCallId = await drain(await a.approveToolCall({ runId, toolCallId: toolCallId! }));
    }

    const snapshot: any = await workflows.loadWorkflowSnapshot({ workflowName: 'agentic-loop', runId });
    const steps = findSteps(snapshot);
    expect(steps.length).toBeGreaterThan(RESUMES);
    const perStep = steps.map(s => (s.content ?? []).filter((p: any) => p.type === 'tool-call').length);
    expect(Math.max(...perStep)).toBe(1);
    const savedIds = steps.flatMap(s =>
      (s.content ?? []).filter((p: any) => p.type === 'tool-call').map((p: any) => p.toolCallId),
    );
    expect(savedIds).toEqual(expectedIds);
  });
});

function findSteps(v: any): any[] {
  if (!v || typeof v !== 'object') return [];
  if (Array.isArray(v.__streamState?.bufferedSteps)) return v.__streamState.bufferedSteps;
  for (const k of Object.keys(v)) {
    const found = findSteps(v[k]);
    if (found.length) return found;
  }
  return [];
}
