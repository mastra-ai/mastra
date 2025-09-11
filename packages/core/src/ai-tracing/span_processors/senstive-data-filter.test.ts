import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultAITracing } from '../tracers';
import type { AITracingEvent, AITracingExporter } from '../types';
import { AISpanType, SamplingStrategyType } from '../types';
import { SensitiveDataFilter } from './sensitive-data-filter';

// Mock console for exporter tests
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Test exporter for capturing events
class TestExporter implements AITracingExporter {
  name = 'test-exporter';
  events: AITracingEvent[] = [];

  async exportEvent(event: AITracingEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  reset(): void {
    this.events = [];
  }
}

describe('AI Tracing', () => {
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
          type: AISpanType.AGENT_RUN,
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
            sessionId: 'session-789', // Should be redacted
            normalField: 'visible-data', // Should NOT be redacted
          },
          aiTracing: {} as any,
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
        expect(attributes?.['sessionId']).toBe('[REDACTED]');

        // Check that normal fields are visible
        expect(attributes?.['normalField']).toBe('visible-data');
        expect(attributes?.['agentId']).toBe('agent-123'); // agentId is part of AgentRunMetadata
      });

      it('should allow custom sensitive fields', () => {
        const processor = new SensitiveDataFilter(['customSecret', 'internalId']);

        const mockSpan = {
          id: 'test-span-1',
          name: 'test-span',
          type: AISpanType.AGENT_RUN,
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
          aiTracing: {} as any,
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
          type: AISpanType.LLM_GENERATION,
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
          aiTracing: {} as any,
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
          type: AISpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: circularObj,
          aiTracing: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes;
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
          type: AISpanType.AGENT_RUN,
          startTime: new Date(),
          traceId: 'trace-123',
          trace: { traceId: 'trace-123' } as any,
          attributes: {
            agentId: 'agent-123',
            sensitiveData: 'this-should-not-be-visible',
            problematicObject: problematic,
          },
          aiTracing: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const attributes = filtered!.attributes;
        expect(attributes?.['[FILTERING_ERROR]']).toBe('Attributes were completely redacted due to filtering error');

        // Should NOT contain the original sensitive data
        expect(attributes?.['sensitiveData']).toBeUndefined();
        expect(attributes?.['agentId']).toBeUndefined();
        expect(attributes?.['problematicObject']).toBeUndefined();
      });
    });

    describe('as part of the default config', () => {
      it('should automatically filter sensitive data in default tracing', () => {
        const tracing = new DefaultAITracing({
          serviceName: 'test-tracing',
          name: 'test-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          exporters: [testExporter],
          processors: [new SensitiveDataFilter()],
        });

        const span = tracing.startSpan({
          type: AISpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: {
            agentId: 'agent-123',
            instructions: 'Test agent',
          } as any,
        });

        // Update span with non-standard field that should be filtered
        span.update({ attributes: { apiKey: 'secret-key-456' } as any });

        span.end();

        // Verify events were exported (3 events: start + update + end)
        expect(testExporter.events).toHaveLength(3);

        // Check that the exported span has filtered attributes
        const startSpan = testExporter.events[0].span;
        expect(startSpan.attributes?.['agentId']).toBe('agent-123');
        expect(startSpan.attributes?.['instructions']).toBe('Test agent');

        // Check the updated span for the filtered field
        const updatedSpan = testExporter.events[1].span; // span_updated event
        expect(updatedSpan.attributes?.['apiKey']).toBe('[REDACTED]');
      });
    });
  });
});
