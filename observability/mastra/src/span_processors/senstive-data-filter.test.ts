import type { TracingEvent, ObservabilityExporter } from '@mastra/core/observability';
import { SpanType, SamplingStrategyType } from '@mastra/core/observability';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultObservabilityInstance } from '../instances';
import { SensitiveDataFilter } from './sensitive-data-filter';

// Test exporter for capturing events
class TestExporter implements ObservabilityExporter {
  name = 'test-exporter';
  events: TracingEvent[] = [];

  async exportTracingEvent(event: TracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  reset(): void {
    this.events = [];
  }
}

describe('Tracing', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    vi.resetAllMocks();

    // Reset test exporter
    testExporter = new TestExporter();
  });

  describe('Sensitive Data Filtering', () => {
    describe('SensitiveDataFilter Processor', () => {
      it('should redact default sensitive fields (case-insensitive)', () => {
        const processor = new SensitiveDataFilter();

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            agentId: 'agent-123',
            password: 'secret123', // Should be redacted
            Token: 'bearer-token', // Should be redacted (case insensitive)
            SECRET: 'top-secret', // Should be redacted (case insensitive)
            apiKey: 'api-key-456', // Should be redacted
            AUTHORIZATION: 'Basic xyz', // Should be redacted (case insensitive)
            sessionId: 'session-789', // Should NOT be redacted (sessionId doesn't match sensitive patterns)
            normalField: 'visible-data', // Should NOT be redacted
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes;

        // Check that sensitive fields are redacted
        expect(attributes?.['password']).toBe('[REDACTED]');
        expect(attributes?.['Token']).toBe('[REDACTED]');
        expect(attributes?.['SECRET']).toBe('[REDACTED]');
        expect(attributes?.['apiKey']).toBe('[REDACTED]');
        expect(attributes?.['AUTHORIZATION']).toBe('[REDACTED]');

        // Check that normal fields are visible
        expect(attributes?.['normalField']).toBe('visible-data');
        expect(attributes?.['agentId']).toBe('agent-123'); // agentId is part of AgentRunMetadata
        expect(attributes?.['sessionId']).toBe('session-789'); // sessionId should not be redacted
      });

      it('should NOT redact fields like inputTokens and outputTokens', () => {
        const processor = new SensitiveDataFilter();

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            model: 'gpt-4',
            inputTokens: 100, // Should NOT be redacted (normalizes to "inputtokens", not "token")
            outputTokens: 50, // Should NOT be redacted (normalizes to "outputtokens")
            input_tokens: 100, // Should NOT be redacted (normalizes to "inputtokens")
            output_tokens: 50, // Should NOT be redacted (normalizes to "outputtokens")
            token: 'auth-token-123', // Should be redacted (normalizes to "token")
            authToken: 'bearer-456', // Should NOT be redacted (normalizes to "authtoken", not "token")
            api_key: 'sk-123456', // Should be redacted (normalizes to "apikey")
            apikey: 'test-key', // Should be redacted (normalizes to "apikey")
            keyword: 'search-term', // Should NOT be redacted (normalizes to "keyword", not "key")
            keystone: 'architecture', // Should NOT be redacted (normalizes to "keystone", not "key")
            monkey: 'business', // Should NOT be redacted (normalizes to "monkey", not "key")
            key: 'secret', // Should be redacted (normalizes to "key")
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes;

        // Check that token-related metrics are NOT redacted
        expect(attributes?.['inputTokens']).toBe(100);
        expect(attributes?.['outputTokens']).toBe(50);
        expect(attributes?.['input_tokens']).toBe(100);
        expect(attributes?.['output_tokens']).toBe(50);

        // Check that fields that don't exactly match after normalization are NOT redacted
        expect(attributes?.['authToken']).toBe('bearer-456');
        expect(attributes?.['keyword']).toBe('search-term');
        expect(attributes?.['keystone']).toBe('architecture');
        expect(attributes?.['monkey']).toBe('business');

        // Check that exact matches after normalization ARE redacted
        expect(attributes?.['token']).toBe('[REDACTED]');
        expect(attributes?.['apikey']).toBe('[REDACTED]');
        expect(attributes?.['api_key']).toBe('[REDACTED]'); // api_key normalizes to apikey
        expect(attributes?.['key']).toBe('[REDACTED]');

        // Check other fields
        expect(attributes?.['model']).toBe('gpt-4');
      });

      it('should allow custom sensitive fields', () => {
        const processor = new SensitiveDataFilter({ sensitiveFields: ['customSecret', 'internalId'] });

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            agentId: 'agent-123',
            password: 'should-be-visible', // NOT in custom list
            customSecret: 'should-be-hidden', // In custom list
            InternalId: 'should-be-hidden', // In custom list (case insensitive)
            publicData: 'visible-data',
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const attributes = filtered!.attributes;

        // Custom fields should be redacted
        expect(attributes?.['customSecret']).toBe('[REDACTED]');
        expect(attributes?.['InternalId']).toBe('[REDACTED]');

        // Default sensitive fields should be visible (not in custom list)
        expect(attributes?.['password']).toBe('should-be-visible');
        expect(attributes?.['publicData']).toBe('visible-data');
        expect(attributes?.['agentId']).toBe('agent-123'); // agentId is part of AgentRunMetadata
      });

      it('should recursively filter nested sensitive fields', () => {
        const processor = new SensitiveDataFilter();

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            model: 'gpt-4',
            apiKey: 'top-level-secret', // Should be redacted (top-level)
            config: {
              apiKey: 'nested-secret', // Should be redacted (nested)
              temperature: 0.7,
              auth: {
                token: 'deeply-nested-secret', // Should be redacted (deeply nested)
                userId: 'user123', // Should be visible
              },
            },
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer xyz', // Should be redacted (nested)
            },
            results: [
              { id: 1, secret: 'array-secret', data: 'visible' }, // Should redact 'secret' in array
              { id: 2, password: 'array-password', value: 42 }, // Should redact 'password' in array
            ],
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const attributes = filtered!.attributes;

        // All sensitive fields should be redacted at any level
        expect(attributes?.['apiKey']).toBe('[REDACTED]');
        expect(attributes?.['config']['apiKey']).toBe('[REDACTED]');
        expect(attributes?.['config']['auth']['token']).toBe('[REDACTED]');
        expect(attributes?.['headers']['Authorization']).toBe('[REDACTED]');
        expect(attributes?.['results'][0]['secret']).toBe('[REDACTED]');
        expect(attributes?.['results'][1]['password']).toBe('[REDACTED]');

        // Non-sensitive fields should be visible
        expect(attributes?.['model']).toBe('gpt-4');
        expect(attributes?.['config']['temperature']).toBe(0.7);
        expect(attributes?.['config']['auth']['userId']).toBe('user123');
        expect(attributes?.['headers']['Content-Type']).toBe('application/json');
        expect(attributes?.['results'][0]['data']).toBe('visible');
        expect(attributes?.['results'][1]['value']).toBe(42);
      });

      it('should redact structured data in JSON strings', () => {
        const processor = new SensitiveDataFilter({
          sensitiveFields: ['fullName', 'email'],
        });

        // Test case that reproduces GitHub issue #9846
        // Where tool outputs get serialized as JSON strings in MODEL_STEP spans
        const mockSpan = {
          id: 'model-step-span',
          name: 'model step',
          type: SpanType.MODEL_STEP,
          startTime: new Date(),
          traceId: 'trace-9846',
          trace: { traceId: 'trace-9846' } as any,
          attributes: {},
          input: {
            messages: [
              {
                role: 'user',
                content: 'get user info for 32ddf',
              },
              {
                role: 'assistant',
                content: null,
                tool_calls: [
                  { id: 'call1', type: 'function', function: { name: 'getUserInfo', arguments: '{"id":"32ddf"}' } },
                ],
              },
              {
                role: 'tool',
                tool_call_id: 'call1',
                content: JSON.stringify({
                  fullName: 'John Doe',
                  email: 'john@email.com',
                  id: '32ddf',
                }),
              },
            ],
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const input = filtered!.input as any;

        // The tool message content should have structured data redacted
        const toolMessage = input?.messages[2];
        const parsedContent = JSON.parse(toolMessage.content);

        // Sensitive fields should be redacted even when in JSON strings
        expect(parsedContent.fullName).toBe('[REDACTED]');
        expect(parsedContent.email).toBe('[REDACTED]');

        // Non-sensitive fields should remain
        expect(parsedContent.id).toBe('32ddf');
      });

      it('should handle invalid JSON strings gracefully', () => {
        const processor = new SensitiveDataFilter({
          sensitiveFields: ['email'],
        });

        const mockSpan = {
          id: 'model-step-span',
          name: 'model step',
          type: SpanType.MODEL_STEP,
          startTime: new Date(),
          traceId: 'trace-9846',
          trace: { traceId: 'trace-9846' } as any,
          attributes: {},
          input: {
            messages: [
              {
                role: 'tool',
                content: '{ email": "test@test.com" }',
              },
            ],
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const input = filtered!.input as any;

        // Invalid JSON should pass through unchanged
        expect(input.messages[0].content).toBe('{ email": "test@test.com" }');
      });

      it('should preserve Date objects in attributes', () => {
        const processor = new SensitiveDataFilter();
        const testDate = new Date('2024-01-15T10:00:00.000Z');

        const mockSpan = {
          id: 'test-span-1',
          name: 'model-generation',
          type: SpanType.MODEL_GENERATION,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            model: 'gpt-4',
            completionStartTime: testDate,
            nestedConfig: {
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date(),
            },
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const attributes = filtered!.attributes;

        // Date objects should be preserved, not converted to {}
        expect(attributes?.completionStartTime).toBeInstanceOf(Date);
        expect(attributes?.completionStartTime.getTime()).toBe(testDate.getTime());
        expect(attributes?.nestedConfig?.createdAt).toBeInstanceOf(Date);
        expect(attributes?.nestedConfig?.updatedAt).toBeInstanceOf(Date);

        // Other fields should still work
        expect(attributes?.model).toBe('gpt-4');
      });

      it('should handle circular references', () => {
        const processor = new SensitiveDataFilter();

        // Create circular reference
        const circularObj: any = {
          name: 'test',
          apiKey: 'should-be-redacted',
        };
        circularObj.self = circularObj;

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: circularObj,
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes as any;
        expect(attributes?.['apiKey']).toBe('[REDACTED]');
        expect(attributes?.['self']).toBe('[Circular Reference]');
        expect(attributes?.['name']).toBe('test');
      });

      it('should return heavily redacted content on filtering error', () => {
        const processor = new SensitiveDataFilter();

        // Create a problematic object that will cause JSON serialization issues
        // This can trigger errors in the deepFilter process
        const problematic: any = {};
        Object.defineProperty(problematic, 'badProp', {
          get() {
            throw new Error('Property access error');
          },
          enumerable: true,
        });

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            agentId: 'agent-123',
            sensitiveData: 'this-should-not-be-visible',
            problematicObject: problematic,
          },
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes as any;
        expect(attributes?.['error']).toStrictEqual({ processor: 'sensitive-data-filter' });

        // Should NOT contain the original sensitive data
        expect(attributes?.['agentId']).toBeUndefined();
        expect(attributes?.['sensitiveData']).toBeUndefined();
        expect(attributes?.['problematicObject']).toBeUndefined();
      });
    });

    describe('score filtering', () => {
      it('should filter sensitive keys in score metadata', () => {
        const processor = new SensitiveDataFilter();

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: SpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          attributes: {},
          scores: [
            {
              scorerName: 'test-scorer',
              score: 0.85,
              reason: 'Good response',
              metadata: {
                analyzeStepResult: { token: 'secret-token-123', safeField: 'visible' },
                apiKey: 'sk-test-key',
              },
              timestamp: Date.now(),
            },
          ],
          observabilityInstance: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);

        expect(filtered.scores).toHaveLength(1);
        // Sensitive keys should be redacted
        expect(filtered.scores?.[0].metadata?.analyzeStepResult?.token).toBe('[REDACTED]');
        expect(filtered.scores?.[0].metadata?.apiKey).toBe('[REDACTED]');
        // Non-sensitive fields should remain
        expect(filtered.scores?.[0].metadata?.analyzeStepResult?.safeField).toBe('visible');
      });

      it('should handle scores flowing through the pipeline', () => {
        const tracing = new DefaultObservabilityInstance({
          serviceName: 'test-tracing',
          name: 'test-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [testExporter],
          spanOutputProcessors: [new SensitiveDataFilter()],
        });

        const span = tracing.startSpan({
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: {},
        });

        span.addScore({
          scorerName: 'test-scorer',
          score: 0.9,
          reason: 'Good response',
          metadata: { token: 'bearer-xyz', safeData: 'visible' },
        });

        span.end();

        const endEvent = testExporter.events.find(e => e.type === 'span_ended');
        expect(endEvent).toBeDefined();
        expect(endEvent?.exportedSpan.scores).toHaveLength(1);
        // Sensitive keys in metadata should be filtered
        expect(endEvent?.exportedSpan.scores?.[0].metadata?.token).toBe('[REDACTED]');
        // Non-sensitive fields should remain
        expect(endEvent?.exportedSpan.scores?.[0].metadata?.safeData).toBe('visible');
      });
    });

    describe('as part of the default config', () => {
      it('should automatically filter sensitive data in default tracing', () => {
        const tracing = new DefaultObservabilityInstance({
          serviceName: 'test-tracing',
          name: 'test-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [testExporter],
          spanOutputProcessors: [new SensitiveDataFilter()],
        });

        const span = tracing.startSpan({
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: {
            agentId: 'agent-123',
            instructions: 'Test agent',
          },
        });

        // Update span with non-standard field that should be filtered
        span.update({ attributes: { apiKey: 'secret-key-456' } as any });

        span.end();

        // Verify events were exported (3 events: start + update + end)
        expect(testExporter.events).toHaveLength(3);

        // Check that the exported span has filtered attributes
        const startSpan = testExporter.events[0].exportedSpan;
        expect((startSpan.attributes as any)?.['agentId']).toBe('agent-123');
        expect((startSpan.attributes as any)?.['instructions']).toBe('Test agent');

        // Check the updated span for the filtered field
        const updatedSpan = testExporter.events[1].exportedSpan; // span_updated event
        expect((updatedSpan.attributes as any)?.['apiKey']).toBe('[REDACTED]');
      });
    });
  });
});
