import { convertArrayToReadableStream, mockValues } from 'ai-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';
import { MessageList } from '../../agent/message-list';
import type { loop } from '../loop';
import { MockTracer } from './mockTracer';
import { createTestModel, testUsage } from './utils';

export function telemetryTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('telemetry', () => {
    let tracer: MockTracer;

    beforeEach(() => {
      tracer = new MockTracer();
    });

    it('should not record any telemetry data when not explicitly enabled', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: 'test-input',
        },
        'input',
      );

      const result = await loopFn({
        runId,
        model: createTestModel(),
        messageList,
        _internal: {
          now: mockValues(0, 100, 500),
        },
      });

      await result.aisdk.v5.consumeStream();

      expect(tracer.jsonSpans).toMatchSnapshot();
    });

    it('should record telemetry data when enabled', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: 'test-input',
        },
        'input',
      );

      const result = await loopFn({
        runId,
        model: createTestModel(),
        messageList,
        modelSettings: {
          topK: 0.1,
          topP: 0.2,
          frequencyPenalty: 0.3,
          presencePenalty: 0.4,
          temperature: 0.5,
          stopSequences: ['stop'],
          maxRetries: 2,
        },
        headers: {
          header1: 'value1',
          header2: 'value2',
        },
        telemetry_settings: {
          isEnabled: true,
          functionId: 'test-function-id',
          metadata: {
            test1: 'value1',
            test2: false,
          },
          tracer,
        },
        _internal: { now: mockValues(0, 100, 500) },
      });

      await result.aisdk.v5.consumeStream();

      expect(tracer.jsonSpans).toMatchSnapshot();
    });

    it('should record successful tool call', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: 'test-input',
        },
        'input',
      );

      const result = await loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        messageList,
        telemetry_settings: { isEnabled: true, tracer },
        _internal: { now: mockValues(0, 100, 500) },
      });

      await result.aisdk.v5.consumeStream();

      expect(tracer.jsonSpans).toMatchSnapshot();
    });

    it('should record error on tool call', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: 'test-input',
        },
        'input',
      );

      const result = await loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async () => {
              throw new Error('Tool execution failed');
            },
          },
        },
        messageList,
        telemetry_settings: { isEnabled: true, tracer },
        _internal: { now: mockValues(0, 100, 500) },
      });

      await result.aisdk.v5.consumeStream();

      expect(tracer.jsonSpans).toHaveLength(3);

      // Check that we have the expected spans
      expect(tracer.jsonSpans?.[0]?.name).toBe('mastra.stream');
      expect(tracer.jsonSpans?.[1]?.name).toBe('mastra.stream.aisdk.doStream');
      expect(tracer.jsonSpans?.[2]?.name).toBe('mastra.stream.toolCall');

      // Check that the tool call span has error status
      const toolCallSpan = tracer.jsonSpans?.[2];
      expect(toolCallSpan?.status).toEqual({
        code: 2,
        message: 'Tool execution failed',
      });

      // Check that the tool call span has exception event
      expect(toolCallSpan?.events).toHaveLength(1);
      const exceptionEvent = toolCallSpan?.events?.[0];
      expect(exceptionEvent?.name).toBe('exception');
      expect(exceptionEvent?.attributes).toMatchObject({
        'exception.message': 'Tool execution failed',
        'exception.name': 'Error',
      });
      expect(exceptionEvent?.attributes?.['exception.stack']).toContain('Tool execution failed');
      expect(exceptionEvent?.time).toEqual([0, 0]);
    });

    it('should not record telemetry inputs / outputs when disabled', async () => {
      const messageList = new MessageList();
      messageList.add(
        {
          role: 'user',
          content: 'test-input',
        },
        'input',
      );
      const result = await loopFn({
        runId,
        model: createTestModel({
          stream: convertArrayToReadableStream([
            {
              type: 'response-metadata',
              id: 'id-0',
              modelId: 'mock-model-id',
              timestamp: new Date(0),
            },
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'tool1',
              input: `{ "value": "value" }`,
            },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: testUsage,
            },
          ]),
        }),
        tools: {
          tool1: {
            inputSchema: z.object({ value: z.string() }),
            execute: async ({ value }) => `${value}-result`,
          },
        },
        messageList,
        telemetry_settings: {
          isEnabled: true,
          recordInputs: false,
          recordOutputs: false,
          tracer,
        },
        _internal: { now: mockValues(0, 100, 500) },
      });

      await result.aisdk.v5.consumeStream();

      expect(tracer.jsonSpans).toMatchSnapshot();
    });
  });
}
