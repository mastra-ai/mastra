import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

function createRecordingStreamModel(modelId: string, responseText: string) {
  return new MockLanguageModelV2({
    modelId,
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId, timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: responseText },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 } },
      ]),
    }),
  });
}

describe('Agent default modelSettings', () => {
  it('should not inject a temperature when the caller did not set one', async () => {
    // Regression test for https://github.com/mastra-ai/mastra/issues/15240.
    // Previously the agent stream workflow forced `temperature: 0` into modelSettings
    // whenever the caller didn't specify one, which broke models that restrict
    // temperature (for example Moonshot Kimi K2.5, which rejects any value other
    // than 1 with `400 Bad Request`).
    const model = createRecordingStreamModel('default-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-default-temperature',
      name: 'Default Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await (
      await agent.stream('Hi')
    ).text;

    expect(model.doStreamCalls[0]?.temperature).toBeUndefined();
  });

  it('should forward a temperature of 0 when the caller explicitly sets it', async () => {
    const model = createRecordingStreamModel('explicit-zero-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-explicit-zero-temperature',
      name: 'Explicit Zero Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await (
      await agent.stream('Hi', { modelSettings: { temperature: 0 } })
    ).text;

    expect(model.doStreamCalls[0]?.temperature).toBe(0);
  });
});
