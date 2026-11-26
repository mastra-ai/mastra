import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as observabilityUtils from '../../observability/utils';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

function createModel(prompts: unknown[]) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      prompts.push(prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
      };
    },
  });
}

describe('AGENT_RUN span signal attributes', () => {
  let agentRunCalls: any[];

  beforeEach(() => {
    agentThreadStreamRuntime.resetForTests();
    agentRunCalls = [];
    const original = observabilityUtils.getOrCreateSpan;
    vi.spyOn(observabilityUtils, 'getOrCreateSpan').mockImplementation(((opts: any) => {
      if (opts.type === 'agent_run') agentRunCalls.push(opts);
      return original(opts);
    }) as typeof original);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records the typed signal that started a queueSignal run', async () => {
    const prompts: unknown[] = [];
    const agent = new Agent({
      id: 'span-agent',
      name: 'Span Agent',
      instructions: 'Test',
      model: createModel(prompts),
    });

    const result = agent.queueSignal(
      { type: 'reactive', tagName: 'skill', attributes: { name: 'factory-triage' }, contents: 'Triage it.' },
      { resourceId: 'span-user', threadId: 'span-thread' },
    );
    const settled = await result.accepted;
    expect(settled.action).toBe('wake');
    if (settled.action !== 'wake') throw new Error('expected wake');
    await settled.output.text;

    expect(agentRunCalls).toHaveLength(1);
    expect(agentRunCalls[0].attributes.signal).toEqual({
      id: result.signal.id,
      type: 'reactive',
      tagName: 'skill',
      attributes: { name: 'factory-triage' },
    });
    expect(JSON.stringify(prompts[0])).toContain('<skill name=\\"factory-triage\\">Triage it.</skill>');
  });

  it('records no signal attribute for a plain stream run', async () => {
    const agent = new Agent({ id: 'span-agent', name: 'Span Agent', instructions: 'Test', model: createModel([]) });

    const stream = await agent.stream('hi');
    await stream.text;

    expect(agentRunCalls).toHaveLength(1);
    expect(agentRunCalls[0].attributes).not.toHaveProperty('signal');
  });
});
