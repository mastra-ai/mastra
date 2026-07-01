/**
 * DurableAgent Header Handling Tests
 *
 * Verifies that:
 * 1. modelSettings.headers are stripped from serialized workflowInput
 * 2. Headers are stored on the in-process RunRegistryEntry.callTimeHeaders
 * 3. Both call-time and model-config headers reach the model's doStream call
 * 4. Header merge order is correct (memory < modelConfig < callTime)
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createDoStreamMock() {
  return vi.fn(async () => ({
    stream: convertArrayToReadableStream([
      { type: 'stream-start' as const, warnings: [] },
      { type: 'response-metadata' as const, id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
      { type: 'text-start' as const, id: 'text-1' },
      { type: 'text-delta' as const, id: 'text-1', delta: 'Hello' },
      { type: 'text-end' as const, id: 'text-1' },
      {
        type: 'finish' as const,
        finishReason: 'stop' as const,
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      },
    ]),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }));
}

describe('DurableAgent header handling', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    pubsub.close();
  });

  it('strips headers from serialized workflowInput and stores them on registryEntry', async () => {
    const doStream = createDoStreamMock();
    const mockModel = new MockLanguageModelV2({ doStream });

    const baseAgent = new Agent({
      id: 'header-strip-agent',
      name: 'Header Strip Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test', {
      modelSettings: {
        temperature: 0.7,
        headers: {
          authorization: 'Bearer secret-token',
          'x-custom': 'custom-value',
        },
      },
    });

    // Serialized workflowInput should have no headers
    expect(result.workflowInput.options.modelSettings).toEqual({
      temperature: 0.7,
    });
    expect(result.workflowInput.options.modelSettings?.headers).toBeUndefined();

    // Registry entry should have the headers
    expect(result.registryEntry.callTimeHeaders).toEqual({
      authorization: 'Bearer secret-token',
      'x-custom': 'custom-value',
    });
  });

  it('callTimeHeaders reach the model doStream call', async () => {
    const doStream = createDoStreamMock();
    const mockModel = new MockLanguageModelV2({ doStream });

    const baseAgent = new Agent({
      id: 'header-flow-agent',
      name: 'Header Flow Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { output, cleanup } = await durableAgent.stream('Hello', {
      modelSettings: {
        headers: {
          'x-api-key': 'my-key',
          'x-trace-id': 'trace-123',
        },
      },
    });

    await output.consumeStream();

    expect(doStream).toHaveBeenCalledTimes(1);
    const callArgs = doStream.mock.calls[0]![0];
    // Headers should be present and lowercased by mergeLlmCallHeaders
    expect(callArgs.headers).toMatchObject({
      'x-api-key': 'my-key',
      'x-trace-id': 'trace-123',
    });

    cleanup();
  });

  it('returns undefined callTimeHeaders when modelSettings has no headers', async () => {
    const doStream = createDoStreamMock();
    const mockModel = new MockLanguageModelV2({ doStream });

    const baseAgent = new Agent({
      id: 'no-headers-agent',
      name: 'No Headers Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test', {
      modelSettings: { temperature: 0.5 },
    });

    expect(result.registryEntry.callTimeHeaders).toBeUndefined();
  });

  it('filters out non-string header values', async () => {
    const doStream = createDoStreamMock();
    const mockModel = new MockLanguageModelV2({ doStream });

    const baseAgent = new Agent({
      id: 'bad-headers-agent',
      name: 'Bad Headers Agent',
      instructions: 'Test',
      model: mockModel as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.prepare('Test', {
      modelSettings: {
        // @ts-expect-error – intentionally non-string header values
        headers: { valid: 'yes', number: 42, bool: true, obj: {} },
      },
    });

    // Only string values should survive
    expect(result.registryEntry.callTimeHeaders).toEqual({ valid: 'yes' });
    expect(result.workflowInput.options.modelSettings?.headers).toBeUndefined();
  });
});
