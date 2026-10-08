import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { InputProcessor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

const toolCallStep = (id: string) => [
  { type: 'stream-start' as const, warnings: [] },
  { type: 'tool-call' as const, toolCallId: id, toolName: 'lookup', input: '{}' },
  { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
];

/** Three tool-call steps (the third with two parallel calls), then a text answer. */
function makeModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const chunks =
        calls === 3
          ? [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'tool-call' as const, toolCallId: 'call-3a', toolName: 'lookup', input: '{}' },
              { type: 'tool-call' as const, toolCallId: 'call-3b', toolName: 'lookup', input: '{}' },
              { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
            ]
          : calls < 3
            ? toolCallStep(`call-${calls}`)
            : [
                { type: 'stream-start' as const, warnings: [] },
                { type: 'text-start' as const, id: 'text' },
                { type: 'text-delta' as const, id: 'text', delta: 'done' },
                { type: 'text-end' as const, id: 'text' },
                { type: 'finish' as const, finishReason: 'stop' as const, usage },
              ];
      return { stream: convertArrayToReadableStream<any>(chunks) };
    },
  });
}

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

function toolCallIds(content: { type: string; toolCallId?: string }[]) {
  return content.filter(part => part.type === 'tool-call').map(part => part.toolCallId);
}

describe('step content after mid-run response pruning (#26357)', () => {
  it('keeps content for steps that run after response messages were pruned', async () => {
    const seenByInputStep: Record<number, { type: string; toolCallId?: string }[][]> = {};

    // Mimics Observational Memory removing already-observed response messages mid-run.
    const pruneResponseMessages: InputProcessor = {
      id: 'om-like-pruner',
      processInputStep: async ({ stepNumber, messageList, steps }) => {
        seenByInputStep[stepNumber] = steps.map(step => step.content as any);
        if (stepNumber === 2) {
          messageList.removeByIds(messageList.get.response.db().map(message => message.id));
        }
        return {};
      },
    };

    const agent = new Agent({
      id: 'om-pruning-agent',
      name: 'om-pruning-agent',
      instructions: 'test',
      model: makeModel(),
      tools: { lookup: lookupTool },
      inputProcessors: [pruneResponseMessages],
    });

    const output = await agent.stream('hi');
    const result = await output.getFullOutput();
    expect(result.steps).toHaveLength(4);

    // Steps handed to processInputStep after the prune must still carry their content.
    const stepsAtLastInput = seenByInputStep[3]!;
    expect(stepsAtLastInput).toHaveLength(3);
    expect(toolCallIds(stepsAtLastInput[0]!)).toEqual(['call-1']);
    expect(toolCallIds(stepsAtLastInput[1]!)).toEqual(['call-2']);
    expect(toolCallIds(stepsAtLastInput[2]!)).toEqual(['call-3a', 'call-3b']);
    expect(stepsAtLastInput[2]!.filter(part => part.type === 'tool-result')).toHaveLength(2);
  });
});
