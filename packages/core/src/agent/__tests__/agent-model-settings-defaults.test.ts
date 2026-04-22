import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { Agent } from '../agent';

function createRecordingModel(modelId: string, responseText: string) {
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
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: responseText }],
    }),
  });
}

describe('Agent default modelSettings', () => {
  // Regression tests for https://github.com/mastra-ai/mastra/issues/15240.
  // Previously the agent workflow forced `temperature: 0` into modelSettings
  // whenever the caller didn't specify one, which broke models that restrict
  // temperature (for example Moonshot Kimi K2.5, which rejects any value other
  // than 1 with `400 Bad Request`).

  it('stream: should not inject a temperature when the caller did not set one', async () => {
    const model = createRecordingModel('stream-default-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-stream-default-temperature',
      name: 'Stream Default Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await (
      await agent.stream('Hi')
    ).text;

    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0].temperature).toBeUndefined();
  });

  it('stream: should forward a temperature of 0 when the caller explicitly sets it', async () => {
    const model = createRecordingModel('stream-explicit-zero-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-stream-explicit-zero-temperature',
      name: 'Stream Explicit Zero Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await (
      await agent.stream('Hi', { modelSettings: { temperature: 0 } })
    ).text;

    expect(model.doStreamCalls).toHaveLength(1);
    expect(model.doStreamCalls[0].temperature).toBe(0);
  });

  it('generate: should not inject a temperature when the caller did not set one', async () => {
    const model = createRecordingModel('generate-default-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-generate-default-temperature',
      name: 'Generate Default Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await agent.generate('Hi');

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0].temperature).toBeUndefined();
  });

  it('generate: should forward a temperature of 0 when the caller explicitly sets it', async () => {
    const model = createRecordingModel('generate-explicit-zero-temperature', 'hello');

    const agent = new Agent({
      id: 'agent-generate-explicit-zero-temperature',
      name: 'Generate Explicit Zero Temperature Agent',
      instructions: 'You are a test agent',
      model,
    });

    await agent.generate('Hi', { modelSettings: { temperature: 0 } });

    expect(model.doGenerateCalls).toHaveLength(1);
    expect(model.doGenerateCalls[0].temperature).toBe(0);
  });
});
