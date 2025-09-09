import { describe, it, expect } from 'vitest';
import { ChunkFrom } from '../../types';
import { convertFullStreamChunkToMastra } from './transform';

describe('convertFullStreamChunkToMastra', () => {
  const testContext = {
    runId: 'test-run-id',
  };

  it('should return undefined for unknown chunk type', () => {
    // Arrange: Create input with unknown type
    const unknownTypeValue = {
      type: 'unknown-type',
      messageId: 'test-message',
      request: {
        body: '{}',
      },
    };

    // Act: Convert the unknown type value
    const result = convertFullStreamChunkToMastra(unknownTypeValue, testContext);

    // Assert: Verify undefined is returned
    expect(result).toBeUndefined();
  });

  it('should handle null/undefined request body for step-start type', () => {
    // Arrange: Create step-start input with null body
    const stepStartValue = {
      type: 'step-start',
      messageId: 'test-message',
      request: {
        body: null,
      },
      warnings: [],
    };

    // Act: Convert the step-start value
    const result = convertFullStreamChunkToMastra(stepStartValue, testContext);

    // Assert: Verify structure and empty body parsing
    expect(result).toEqual({
      type: 'step-start',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        messageId: 'test-message',
        request: {
          body: {},
        },
        warnings: [],
      },
    });
  });

  it('should handle valid JSON request body for step-start type', () => {
    // Arrange: Create step-start chunk with valid JSON in request.body
    const stepStartValue = {
      type: 'step-start',
      messageId: 'test-message-id',
      request: {
        body: JSON.stringify({
          foo: 'bar',
          nested: { value: 123 },
        }),
      },
      warnings: ['warning1', 'warning2'],
    };

    // Act: Convert the step-start value
    const result = convertFullStreamChunkToMastra(stepStartValue, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'step-start',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        messageId: 'test-message-id',
        request: {
          body: {
            foo: 'bar',
            nested: { value: 123 },
          },
        },
        warnings: ['warning1', 'warning2'],
      },
    });
  });

  it('should correctly transform tool-call type chunks', () => {
    // Arrange: Create tool call input with required fields
    const toolCallInput = {
      type: 'tool-call',
      toolCallId: 'test-tool-call-id',
      args: { param1: 'value1', param2: 'value2' },
      toolName: 'test-tool',
    };

    // Act: Convert the tool-call value
    const result = convertFullStreamChunkToMastra(toolCallInput, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'tool-call',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'test-tool-call-id',
        args: { param1: 'value1', param2: 'value2' },
        toolName: 'test-tool',
      },
    });
  });

  it('should correctly transform step-finish type chunks', () => {
    // Arrange: Create step-finish input with all required fields
    const stepFinishInput = {
      type: 'step-finish',
      id: 'test-step-id',
      finishReason: 'complete',
      usage: { total_tokens: 150, completion_tokens: 50, prompt_tokens: 100 },
      response: { content: 'Test response content' },
      messageId: 'test-message-id',
      providerMetadata: { model: 'test-model', temperature: 0.7 },
      warnings: ['warning1', 'warning2'],
      isContinued: true,
      logprobs: { token_logprobs: [-0.1, -0.2] },
      request: {
        input: 'test input',
        parameters: { max_tokens: 100 },
      },
      messages: {
        all: [{ role: 'user', content: 'test message' }],
        user: [{ role: 'user', content: 'test message' }],
        nonUser: [],
      },
    };

    // Act: Convert the step-finish value
    const result = convertFullStreamChunkToMastra(stepFinishInput, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'step-finish',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: 'test-step-id',
        reason: 'complete',
        usage: { total_tokens: 150, completion_tokens: 50, prompt_tokens: 100 },
        response: { content: 'Test response content' },
        messageId: 'test-message-id',
        providerMetadata: { model: 'test-model', temperature: 0.7 },
        stepResult: {
          reason: 'complete',
          warnings: ['warning1', 'warning2'],
          isContinued: true,
          logprobs: { token_logprobs: [-0.1, -0.2] },
        },
        output: {
          usage: { total_tokens: 150, completion_tokens: 50, prompt_tokens: 100 },
        },
        metadata: {
          request: {
            input: 'test input',
            parameters: { max_tokens: 100 },
          },
          providerMetadata: { model: 'test-model', temperature: 0.7 },
        },
        messages: {
          all: [{ role: 'user', content: 'test message' }],
          user: [{ role: 'user', content: 'test message' }],
          nonUser: [],
        },
      },
    });
  });

  it('should default messages arrays when messages is null or undefined in finish type chunks', () => {
    // Arrange: Create finish type inputs with null and undefined messages
    const finishInputWithNull = {
      type: 'finish',
      id: 'test-id-1',
      usage: { total_tokens: 100 },
      totalUsage: { total_tokens: 500 },
      finishReason: 'complete',
      warnings: [],
      isContinued: false,
      logprobs: null,
      request: { input: 'test' },
      providerMetadata: { model: 'test-model' },
      messages: null,
    };

    const finishInputWithUndefined = {
      type: 'finish',
      id: 'test-id-2',
      usage: { total_tokens: 200 },
      totalUsage: { total_tokens: 600 },
      finishReason: 'complete',
      warnings: [],
      isContinued: false,
      logprobs: null,
      request: { input: 'test' },
      providerMetadata: { model: 'test-model' },
    };

    // Act: Convert both finish values
    const resultWithNull = convertFullStreamChunkToMastra(finishInputWithNull, testContext);
    const resultWithUndefined = convertFullStreamChunkToMastra(finishInputWithUndefined, testContext);

    // Assert: Verify default empty arrays for messages
    const expectedMessagesStructure = {
      all: [],
      user: [],
      nonUser: [],
    };

    expect(resultWithNull?.payload.messages).toEqual(expectedMessagesStructure);
    expect(resultWithUndefined?.payload.messages).toEqual(expectedMessagesStructure);

    // Assert: Verify other fields are correctly mapped
    [resultWithNull, resultWithUndefined].forEach(result => {
      expect(result).toMatchObject({
        type: 'finish',
        runId: testContext.runId,
        from: ChunkFrom.AGENT,
        payload: {
          stepResult: {
            reason: 'complete',
            warnings: [],
            isContinued: false,
            logprobs: null,
          },
          metadata: {
            request: { input: 'test' },
            providerMetadata: { model: 'test-model' },
          },
        },
      });
    });
  });

  it('should correctly map messages arrays for finish type', () => {
    // Arrange: Create finish chunk with populated messages object
    const finishValue = {
      type: 'finish',
      id: 'test-finish-id',
      usage: { total_tokens: 100, completion_tokens: 50, prompt_tokens: 50 },
      totalUsage: { total_tokens: 500, completion_tokens: 250, prompt_tokens: 250 },
      finishReason: 'complete',
      warnings: ['warning1'],
      isContinued: false,
      logprobs: { token_logprobs: [-0.1] },
      request: { input: 'test input' },
      providerMetadata: { model: 'test-model' },
      messages: {
        all: [
          { role: 'user', content: 'user message 1' },
          { role: 'assistant', content: 'assistant message 1' },
        ],
        user: [{ role: 'user', content: 'user message 1' }],
        nonUser: [{ role: 'assistant', content: 'assistant message 1' }],
      },
    };

    // Act: Convert the finish value
    const result = convertFullStreamChunkToMastra(finishValue, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'finish',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: 'test-finish-id',
        usage: { total_tokens: 100, completion_tokens: 50, prompt_tokens: 50 },
        totalUsage: { total_tokens: 500, completion_tokens: 250, prompt_tokens: 250 },
        providerMetadata: { model: 'test-model' },
        stepResult: {
          reason: 'complete',
          warnings: ['warning1'],
          isContinued: false,
          logprobs: { token_logprobs: [-0.1] },
        },
        output: {
          usage: { total_tokens: 100, completion_tokens: 50, prompt_tokens: 50 },
        },
        metadata: {
          request: { input: 'test input' },
          providerMetadata: { model: 'test-model' },
        },
        messages: {
          all: [
            { role: 'user', content: 'user message 1' },
            { role: 'assistant', content: 'assistant message 1' },
          ],
          user: [{ role: 'user', content: 'user message 1' }],
          nonUser: [{ role: 'assistant', content: 'assistant message 1' }],
        },
      },
    });
  });

  it('should correctly transform tool-result type chunks', () => {
    // Arrange: Create tool-result input
    const toolResultValue = {
      type: 'tool-result',
      toolCallId: 'test-tool-call-id',
      toolName: 'test-tool-name',
      result: {
        data: 'test-result-data',
        status: 'success',
      },
    };

    // Act: Convert the tool-result value
    const result = convertFullStreamChunkToMastra(toolResultValue, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'tool-result',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        toolCallId: 'test-tool-call-id',
        toolName: 'test-tool-name',
        result: {
          data: 'test-result-data',
          status: 'success',
        },
      },
    });
  });

  it('should correctly transform text-delta type chunks', () => {
    // Arrange: Create text-delta input
    const textDeltaValue = {
      type: 'text-delta',
      id: 'test-delta-id',
      textDelta: 'Some incremental text update',
    };

    // Act: Convert the text-delta value
    const result = convertFullStreamChunkToMastra(textDeltaValue, testContext);

    // Assert: Verify structure and field values
    expect(result).toEqual({
      type: 'text-delta',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        id: 'test-delta-id',
        text: 'Some incremental text update',
      },
    });
  });

  it('should correctly transform tripwire type chunks', () => {
    // Arrange: Create tripwire input with reason
    const tripwireInput = {
      type: 'tripwire',
      tripwireReason: 'content_filter_triggered',
    };

    // Act: Convert the tripwire value
    const result = convertFullStreamChunkToMastra(tripwireInput, testContext);

    // Assert: Verify structure and tripwire reason
    expect(result).toEqual({
      type: 'tripwire',
      runId: testContext.runId,
      from: ChunkFrom.AGENT,
      payload: {
        tripwireReason: 'content_filter_triggered',
      },
    });
  });
});
