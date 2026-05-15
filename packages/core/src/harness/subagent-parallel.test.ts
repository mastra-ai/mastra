import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { delay } from '../utils';
import { Harness } from './harness';
import type { HarnessSubagent } from './types';

describe('Harness subagent parallel execution', () => {
  it('runs multiple built-in subagent calls concurrently with Harness approval enabled', async () => {
    const starts: number[] = [];
    const finishes: number[] = [];

    const subagentModel = new MockLanguageModelV2({
      doStream: async () => {
        starts.push(Date.now());
        await delay(80);
        finishes.push(Date.now());

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: `subagent-${starts.length}`,
              modelId: 'mock-subagent',
              timestamp: new Date(0),
            },
            { type: 'text-delta', textDelta: `Subagent ${starts.length} done.` },
            {
              type: 'finish',
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    let parentCallCount = 0;
    const parentModel = new MockLanguageModelV2({
      doStream: async () => {
        parentCallCount++;

        if (parentCallCount === 1) {
          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              {
                type: 'response-metadata',
                id: 'parent-1',
                modelId: 'mock-parent',
                timestamp: new Date(0),
              },
              {
                type: 'tool-call',
                toolCallId: 'subagent-call-1',
                toolName: 'subagent',
                input: JSON.stringify({ agentType: 'explore', task: 'Investigate area one' }),
                providerExecuted: false,
              },
              {
                type: 'tool-call',
                toolCallId: 'subagent-call-2',
                toolName: 'subagent',
                input: JSON.stringify({ agentType: 'explore', task: 'Investigate area two' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            {
              type: 'response-metadata',
              id: 'parent-2',
              modelId: 'mock-parent',
              timestamp: new Date(0),
            },
            { type: 'text-delta', textDelta: 'Done.' },
            {
              type: 'finish',
              finishReason: 'stop' as const,
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
        };
      },
    });

    const parentAgent = new Agent({
      id: 'parallel-parent',
      name: 'Parallel Parent',
      instructions: 'Delegate independent tasks to subagents.',
      model: parentModel,
    });

    const subagents: HarnessSubagent[] = [
      {
        id: 'explore',
        name: 'Explore',
        description: 'Read-only investigation.',
        instructions: 'Investigate independently.',
        defaultModelId: 'mock-subagent',
      },
    ];

    const harness = new Harness({
      id: 'parallel-subagent-harness',
      storage: new InMemoryStore(),
      modes: [{ id: 'default', name: 'Default', default: true, agent: parentAgent, defaultModelId: 'mock-parent' }],
      subagents,
      resolveModel: () => subagentModel as any,
      initialState: { yolo: false } as any,
    });

    const approvalRequests: string[] = [];
    harness.subscribe(event => {
      if (event.type === 'tool_approval_required') {
        approvalRequests.push(event.toolName);
      }
    });

    await harness.init();
    await harness.sendMessage({ content: 'Run two independent investigations.' });

    expect(approvalRequests).toEqual([]);
    expect(starts).toHaveLength(2);
    expect(finishes).toHaveLength(2);
    expect(Math.max(...starts)).toBeLessThan(Math.min(...finishes));
  });
});
