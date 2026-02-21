/**
 * When a model emits text-delta alongside tool calls in intermediate steps,
 * the tool result JSON should not leak into the text stream as text-delta events.
 */
import { convertAsyncIterableToArray } from '@ai-sdk/provider-utils-v5/test';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { convertArrayToReadableStream, mockId, mockValues } from '@internal/ai-sdk-v5/test';
import { beforeEach, describe, expect, it } from 'vitest';
import z from 'zod';
import type { MastraModelOutput } from '../../stream/base/output';
import type { loop } from '../loop';
import { MastraLanguageModelV2Mock as MockLanguageModelV2 } from './MastraLanguageModelV2Mock';
import { createMessageListWithUserMessage, defaultSettings, testUsage } from './utils';

export function textDeltaToolLeakTests({ loopFn, runId }: { loopFn: typeof loop; runId: string }) {
  describe('tool result JSON should not leak into text-delta events', () => {
    /**
     * Scenario:
     *   Step 1: model emits text-delta with JSON + tool-call (classifyDefect)
     *   Step 2: model emits actual text response
     *
     * Text from step 1 should NOT appear in the final text output.
     */
    describe('text-delta alongside tool calls in intermediate step', () => {
      let result: MastraModelOutput<unknown>;
      const toolResultJson = '{"priority":"critical","recommendation":"Replace defective component immediately"}';

      beforeEach(async () => {
        let responseCount = 0;
        result = await loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => {
                  switch (responseCount++) {
                    case 0:
                      // Step 1: Model emits text (tool result JSON) alongside tool calls
                      return {
                        warnings: [],
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-0',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          // Model emits tool result JSON as text
                          { type: 'text-start', id: 'text-1' },
                          { type: 'text-delta', id: 'text-1', delta: toolResultJson },
                          { type: 'text-end', id: 'text-1' },
                          // Then makes tool calls
                          {
                            type: 'tool-call',
                            toolCallId: 'call-1',
                            toolName: 'classifyDefect',
                            input: '{"description":"Component failure"}',
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                      };
                    case 1:
                      // Step 2: Model responds with actual text
                      return {
                        warnings: [],
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-1',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          { type: 'text-start', id: 'text-2' },
                          {
                            type: 'text-delta',
                            id: 'text-2',
                            delta: 'The defect has been classified as critical.',
                          },
                          { type: 'text-end', id: 'text-2' },
                          {
                            type: 'finish',
                            finishReason: 'stop',
                            usage: testUsage,
                          },
                        ]),
                      };
                    default:
                      throw new Error(`Unexpected response count: ${responseCount}`);
                  }
                },
              }),
            },
          ],
          tools: {
            classifyDefect: {
              inputSchema: z.object({ description: z.string() }),
              execute: async ({ description }: { description: string }): Promise<object> => {
                return { priority: 'critical', recommendation: 'Replace defective component immediately' };
              },
            },
          },
          stopWhen: stepCountIs(3),
          ...defaultSettings(),
        });
      });

      it('should not include tool result JSON in text-delta events of the full stream', async () => {
        const fullStream = await convertAsyncIterableToArray(result.fullStream as any);

        // Collect all text-delta events
        const textDeltas = fullStream.filter((c: any) => c.type === 'text-delta');
        const allText = textDeltas.map((c: any) => c.text ?? c.delta ?? c.payload?.text).join('');

        // The tool result JSON should NOT appear in text-delta events
        expect(allText).not.toContain(toolResultJson);
        expect(allText).not.toContain('"priority":"critical"');

        // The actual response text SHOULD be present
        expect(allText).toContain('The defect has been classified as critical.');
      });

      it('should not include tool result JSON in result.text', async () => {
        await result.consumeStream();

        const text = await result.text;

        // The tool result JSON should NOT be in the final text
        expect(text).not.toContain(toolResultJson);
        expect(text).not.toContain('"priority":"critical"');

        // The actual response SHOULD be present
        expect(text).toContain('The defect has been classified as critical.');
      });
    });

    /**
     * Step 1: text-delta (JSON) + tool-call (classifyDefect)
     * Step 2: text-delta (JSON) + tool-call (recordDefect) + tool-call (updateStatus)
     * Step 3: actual text response
     */
    describe('multiple intermediate steps with text alongside tool calls', () => {
      let result: MastraModelOutput<unknown>;
      const step1Json = '{"type":"classification","severity":"high"}';
      const step2Json = '{"recordId":"DEF-001","status":"recorded"}';

      beforeEach(async () => {
        let responseCount = 0;
        result = await loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => {
                  switch (responseCount++) {
                    case 0:
                      return {
                        warnings: [],
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-0',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          { type: 'text-start', id: 'text-1' },
                          { type: 'text-delta', id: 'text-1', delta: step1Json },
                          { type: 'text-end', id: 'text-1' },
                          {
                            type: 'tool-call',
                            toolCallId: 'call-1',
                            toolName: 'classifyDefect',
                            input: '{"item":"widget-A"}',
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                      };
                    case 1:
                      return {
                        warnings: [],
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-1',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          { type: 'text-start', id: 'text-2' },
                          { type: 'text-delta', id: 'text-2', delta: step2Json },
                          { type: 'text-end', id: 'text-2' },
                          {
                            type: 'tool-call',
                            toolCallId: 'call-2',
                            toolName: 'recordDefect',
                            input: '{"severity":"high"}',
                          },
                          {
                            type: 'tool-call',
                            toolCallId: 'call-3',
                            toolName: 'updateStatus',
                            input: '{"status":"in-review"}',
                          },
                          {
                            type: 'finish',
                            finishReason: 'tool-calls',
                            usage: testUsage,
                          },
                        ]),
                      };
                    case 2:
                      return {
                        warnings: [],
                        stream: convertArrayToReadableStream([
                          {
                            type: 'response-metadata',
                            id: 'id-2',
                            modelId: 'mock-model-id',
                            timestamp: new Date(0),
                          },
                          { type: 'text-start', id: 'text-3' },
                          {
                            type: 'text-delta',
                            id: 'text-3',
                            delta: 'Defect classified, recorded, and status updated.',
                          },
                          { type: 'text-end', id: 'text-3' },
                          {
                            type: 'finish',
                            finishReason: 'stop',
                            usage: testUsage,
                          },
                        ]),
                      };
                    default:
                      throw new Error(`Unexpected response count: ${responseCount}`);
                  }
                },
              }),
            },
          ],
          tools: {
            classifyDefect: {
              inputSchema: z.object({ item: z.string() }),
              execute: async (): Promise<object> => ({ type: 'classification', severity: 'high' }),
            },
            recordDefect: {
              inputSchema: z.object({ severity: z.string() }),
              execute: async (): Promise<object> => ({ recordId: 'DEF-001', status: 'recorded' }),
            },
            updateStatus: {
              inputSchema: z.object({ status: z.string() }),
              execute: async (): Promise<object> => ({ updated: true }),
            },
          },
          stopWhen: stepCountIs(4),
          ...defaultSettings(),
        });
      });

      it('should not include any intermediate step JSON in text-delta events', async () => {
        const fullStream = await convertAsyncIterableToArray(result.fullStream as any);

        const textDeltas = fullStream.filter((c: any) => c.type === 'text-delta');
        const allText = textDeltas.map((c: any) => c.text ?? c.delta ?? c.payload?.text).join('');

        // Neither step 1 nor step 2 JSON should leak into text
        expect(allText).not.toContain(step1Json);
        expect(allText).not.toContain(step2Json);
        expect(allText).not.toContain('"classification"');
        expect(allText).not.toContain('"recordId"');

        // Only the final response text should be present
        expect(allText).toContain('Defect classified, recorded, and status updated.');
      });

      it('should have clean text in result.text without intermediate JSON', async () => {
        await result.consumeStream();

        const text = await result.text;
        expect(text).not.toContain(step1Json);
        expect(text).not.toContain(step2Json);
        expect(text).toContain('Defect classified, recorded, and status updated.');
      });
    });

    /**
     * Edge case: text-only step (no tool calls) should still produce text-delta.
     * This ensures the fix doesn't suppress legitimate text responses.
     */
    describe('text-only step should still produce text-delta events', () => {
      it('should include text-delta events for steps without tool calls', async () => {
        const result = await loopFn({
          methodType: 'stream',
          runId,
          messageList: createMessageListWithUserMessage(),
          models: [
            {
              id: 'test-model',
              maxRetries: 0,
              model: new MockLanguageModelV2({
                doStream: async () => ({
                  warnings: [],
                  stream: convertArrayToReadableStream([
                    {
                      type: 'response-metadata',
                      id: 'id-0',
                      modelId: 'mock-model-id',
                      timestamp: new Date(0),
                    },
                    { type: 'text-start', id: 'text-1' },
                    { type: 'text-delta', id: 'text-1', delta: 'Hello, ' },
                    { type: 'text-delta', id: 'text-1', delta: 'world!' },
                    { type: 'text-end', id: 'text-1' },
                    {
                      type: 'finish',
                      finishReason: 'stop',
                      usage: testUsage,
                    },
                  ]),
                }),
              }),
            },
          ],
          ...defaultSettings(),
        });

        const fullStream = await convertAsyncIterableToArray(result.fullStream as any);
        const textDeltas = fullStream.filter((c: any) => c.type === 'text-delta');

        // Text-only steps should still have text-delta events
        expect(textDeltas.length).toBeGreaterThan(0);
        const allText = textDeltas.map((c: any) => c.text ?? c.delta ?? c.payload?.text).join('');
        expect(allText).toBe('Hello, world!');
      });
    });
  });
}
