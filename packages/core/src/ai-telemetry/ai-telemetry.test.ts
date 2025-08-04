import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraError } from '../error';
import { DefaultAITelemetry, DefaultConsoleExporter, SensitiveDataFilter } from './default';
import { clearAITelemetryRegistry, getAITelemetry, registerAITelemetry } from './registry';
import type {
  AITelemetryEvent,
  AITelemetryExporter,
  AITelemetrySampler,
  AITraceContext,
  AgentRunMetadata,
  LLMGenerationMetadata,
  ToolCallMetadata,
} from './types';
import { AISpanType } from './types';

// No crypto mocking needed since we use custom generateId function

// Mock console for exporter tests
const mockConsole = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
vi.stubGlobal('console', mockConsole);

// Test exporter for capturing events
class TestExporter implements AITelemetryExporter {
  name = 'test-exporter';
  events: AITelemetryEvent[] = [];

  async exportEvent(event: AITelemetryEvent): Promise<void> {
    this.events.push(event);
  }

  async shutdown(): Promise<void> {
    // no-op
  }

  reset(): void {
    this.events = [];
  }
}

// Test sampler
class TestSampler implements AITelemetrySampler {
  name = 'test-sampler';
  private shouldSampleResult: boolean;

  constructor(shouldSample: boolean) {
    this.shouldSampleResult = shouldSample;
  }

  shouldSample(_traceContext: AITraceContext): boolean {
    return this.shouldSampleResult;
  }
}

describe('AI Telemetry', () => {
  let testExporter: TestExporter;

  beforeEach(() => {
    vi.resetAllMocks();

    // Clear registry
    clearAITelemetryRegistry();

    // Reset test exporter
    testExporter = new TestExporter();
  });

  describe('DefaultAITelemetry', () => {
    it('should create and start spans with type safety', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      // Agent span
      const agentSpan = telemetry.startSpan(AISpanType.AGENT_RUN, 'test-agent', {
        agentId: 'agent-123',
        instructions: 'Test instructions',
        maxSteps: 5,
      });

      expect(agentSpan.id).toMatch(/^[a-f0-9]{16}$/); // OpenTelemetry span ID format
      expect(agentSpan.name).toBe('test-agent');
      expect(agentSpan.type).toBe(AISpanType.AGENT_RUN);
      expect(agentSpan.metadata.agentId).toBe('agent-123');
      expect(agentSpan.startTime).toBeInstanceOf(Date);
      expect(agentSpan.endTime).toBeUndefined();
      expect(agentSpan.trace).toBe(agentSpan); // Root span is its own trace
      expect(agentSpan.traceId).toMatch(/^[a-f0-9]{32}$/); // OpenTelemetry trace ID format
    });

    it('should create child spans with different types', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      const agentSpan = telemetry.startSpan(AISpanType.AGENT_RUN, 'parent-agent', { agentId: 'agent-123' });

      const toolSpan = agentSpan.createChildSpan(AISpanType.TOOL_CALL, 'child-tool', {
        toolId: 'tool-456',
        success: true,
      });

      expect(toolSpan.id).toMatch(/^[a-f0-9]{16}$/); // OpenTelemetry span ID format
      expect(toolSpan.type).toBe(AISpanType.TOOL_CALL);
      expect(toolSpan.metadata.toolId).toBe('tool-456');
      expect(toolSpan.trace).toBe(agentSpan); // Child inherits trace from parent
      expect(toolSpan.traceId).toBe(agentSpan.traceId); // Child spans inherit trace ID
    });

    it('should maintain consistent traceId across span hierarchy', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      // Create root span
      const rootSpan = telemetry.startSpan(AISpanType.AGENT_RUN, 'root-agent', { agentId: 'agent-123' });

      // Create child span
      const childSpan = rootSpan.createChildSpan(AISpanType.LLM_GENERATION, 'child-llm', {
        model: 'gpt-4',
        provider: 'openai',
      });

      // Create grandchild span
      const grandchildSpan = childSpan.createChildSpan(AISpanType.TOOL_CALL, 'grandchild-tool', {
        toolId: 'calculator',
      });

      // All spans should have the same traceId
      expect(rootSpan.traceId).toMatch(/^[a-f0-9]{32}$/); // Valid trace ID format
      expect(childSpan.traceId).toBe(rootSpan.traceId);
      expect(grandchildSpan.traceId).toBe(rootSpan.traceId);

      // But different span IDs
      expect(rootSpan.id).not.toBe(childSpan.id);
      expect(childSpan.id).not.toBe(grandchildSpan.id);
      expect(rootSpan.id).not.toBe(grandchildSpan.id);
    });

    it('should emit events throughout span lifecycle', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.LLM_GENERATION, 'test-llm', { model: 'gpt-4', provider: 'openai' });

      // Should emit span_started
      expect(testExporter.events).toHaveLength(1);
      expect(testExporter.events[0].type).toBe('span_started');
      expect(testExporter.events[0].span.id).toBe(span.id);

      // Update span - cast to LLM metadata type for usage field
      span.update({ usage: { totalTokens: 100 } } as Partial<LLMGenerationMetadata>);

      // Should emit span_updated
      expect(testExporter.events).toHaveLength(2);
      expect(testExporter.events[1].type).toBe('span_updated');
      expect((testExporter.events[1].span.metadata as LLMGenerationMetadata).usage?.totalTokens).toBe(100);

      // End span
      span.end({ usage: { totalTokens: 150 } } as Partial<LLMGenerationMetadata>);

      // Should emit span_ended
      expect(testExporter.events).toHaveLength(3);
      expect(testExporter.events[2].type).toBe('span_ended');
      expect(testExporter.events[2].span.endTime).toBeInstanceOf(Date);
      expect((testExporter.events[2].span.metadata as LLMGenerationMetadata).usage?.totalTokens).toBe(150);
    });

    it('should handle errors with default endSpan=true', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.TOOL_CALL, 'error-tool', { toolId: 'failing-tool' });

      const error = new MastraError({
        id: 'TOOL_ERROR',
        text: 'Tool failed',
        domain: 'TOOL',
        category: 'SYSTEM',
        details: { reason: 'timeout' },
      });

      // Error should end span by default
      span.error(error);

      expect(span.endTime).toBeInstanceOf(Date);
      expect(span.metadata.error?.message).toBe('Tool failed');
      expect(span.metadata.error?.id).toBe('TOOL_ERROR');
      expect(span.metadata.error?.category).toBe('SYSTEM');

      // Should emit span_ended
      expect(testExporter.events).toHaveLength(2); // start + end
      expect(testExporter.events[1].type).toBe('span_ended');
    });

    it('should handle errors with explicit endSpan=false', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.TOOL_CALL, 'recoverable-tool', { toolId: 'retry-tool' });

      const error = new Error('Recoverable error');

      // Error should NOT end span when explicitly set to false
      span.error(error, false);

      expect(span.endTime).toBeUndefined();
      expect(span.metadata.error?.message).toBe('Recoverable error');

      // Should emit span_updated (not ended)
      expect(testExporter.events).toHaveLength(2); // start + update
      expect(testExporter.events[1].type).toBe('span_updated');
    });
  });

  describe('Sampling Strategies', () => {
    it('should always sample with always_on strategy', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        sampling: { type: 'always_on' },
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

      expect(span.id).toMatch(/^[a-f0-9]{16}$/); // OpenTelemetry span ID format
      expect(testExporter.events).toHaveLength(1);
    });

    it('should never sample with always_off strategy', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        sampling: { type: 'always_off' },
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

      expect(span.id).toBe('no-op'); // No-op span created
      expect(testExporter.events).toHaveLength(0);
    });

    it('should sample based on ratio', () => {
      // Mock Math.random to control sampling
      const mockRandom = vi.spyOn(Math, 'random');

      // Test probability = 0.5
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        sampling: { type: 'ratio', probability: 0.5 },
        exporters: [testExporter],
      });

      // First call: random = 0.3 < 0.5 -> should sample
      mockRandom.mockReturnValueOnce(0.3);
      const span1 = telemetry.startSpan(AISpanType.GENERIC, 'test-1', {});
      expect(span1.id).toMatch(/^[a-f0-9]{16}$/); // OpenTelemetry span ID format

      // Second call: random = 0.8 > 0.5 -> should not sample
      mockRandom.mockReturnValueOnce(0.8);
      const span2 = telemetry.startSpan(AISpanType.GENERIC, 'test-2', {});
      expect(span2.id).toBe('no-op');

      mockRandom.mockRestore();
    });

    it('should use custom sampler', () => {
      const customSampler = new TestSampler(false); // Always reject

      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        samplers: [customSampler],
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(
        AISpanType.GENERIC,
        'test-span',
        {},
        undefined,
        undefined, // runtime context
        { attr: 'value' }, // attributes
      );

      expect(span.id).toBe('no-op'); // Custom sampler rejected
      expect(testExporter.events).toHaveLength(0);
    });

    it('should handle invalid ratio probability', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        sampling: { type: 'ratio', probability: 1.5 }, // Invalid > 1
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

      // Should default to no sampling for invalid probability
      expect(span.id).toBe('no-op');
    });
  });

  describe('Exporter Behavior', () => {
    it('should handle exporter errors gracefully', async () => {
      const failingExporter: AITelemetryExporter = {
        name: 'failing-exporter',
        exportEvent: vi.fn().mockRejectedValue(new Error('Export failed')),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [failingExporter, testExporter], // One fails, one succeeds
      });

      telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

      // Wait for async export to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should continue with other exporters despite failure
      expect(testExporter.events).toHaveLength(1);
      expect(failingExporter.exportEvent).toHaveBeenCalled();
    });

    it('should use default console exporter when none provided', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        // No exporters provided
      });

      expect(telemetry.getExporters()).toHaveLength(1);
      expect(telemetry.getExporters()[0]).toBeInstanceOf(DefaultConsoleExporter);
    });

    it('should shutdown all components', async () => {
      const mockExporter = {
        name: 'mock-exporter',
        exportEvent: vi.fn(),
        shutdown: vi.fn().mockResolvedValue(undefined),
      };

      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [mockExporter],
      });

      await telemetry.shutdown();

      expect(mockExporter.shutdown).toHaveBeenCalled();
    });
  });

  describe('Configuration', () => {
    it('should merge with default configuration', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        enabled: false,
        // Other settings should use defaults
      });

      const config = telemetry.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.serviceName).toBe('mastra-service'); // Default
      expect(config.sampling?.type).toBe('always_on'); // Default
    });

    it('should be disabled when enabled=false', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        enabled: false,
        exporters: [testExporter],
      });

      const span = telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

      expect(span.id).toBe('no-op');
      expect(testExporter.events).toHaveLength(0);
    });
  });

  describe('Registry', () => {
    it('should register and retrieve telemetry instances', () => {
      const telemetry = new DefaultAITelemetry({ name: 'registry-test' });

      registerAITelemetry('my-telemetry', telemetry, true);

      expect(getAITelemetry('my-telemetry')).toBe(telemetry);
      expect(getAITelemetry()).toBe(telemetry); // Default instance
    });

    it('should clear registry', () => {
      const telemetry = new DefaultAITelemetry({ name: 'registry-test' });
      registerAITelemetry('test', telemetry);

      clearAITelemetryRegistry();

      expect(getAITelemetry('test')).toBeUndefined();
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct metadata types for different span types', () => {
      const telemetry = new DefaultAITelemetry({
        name: 'test-telemetry',
        exporters: [testExporter],
      });

      // Agent metadata
      const agentSpan = telemetry.startSpan(AISpanType.AGENT_RUN, 'agent-test', {
        agentId: 'agent-123',
        instructions: 'Test agent',
        maxSteps: 10,
        currentStep: 1,
      } as AgentRunMetadata);

      expect(agentSpan.metadata.agentId).toBe('agent-123');

      // LLM metadata
      const llmSpan = telemetry.startSpan(AISpanType.LLM_GENERATION, 'llm-test', {
        model: 'gpt-4',
        provider: 'openai',
        usage: { totalTokens: 100 },
        streaming: false,
      } as LLMGenerationMetadata);

      expect(llmSpan.metadata.model).toBe('gpt-4');

      // Tool metadata
      const toolSpan = telemetry.startSpan(AISpanType.TOOL_CALL, 'tool-test', {
        toolId: 'calculator',
        toolType: 'math',
        success: true,
      } as ToolCallMetadata);

      expect(toolSpan.metadata.toolId).toBe('calculator');
    });
  });

  describe('DefaultConsoleExporter', () => {
    it('should log span events with proper formatting', async () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const exporter = new DefaultConsoleExporter(logger as any);

      const mockSpan = {
        id: 'test-span-1',
        name: 'test-span',
        type: AISpanType.AGENT_RUN,
        startTime: new Date(),
        endTime: new Date(),
        traceId: 'trace-123',
        trace: { traceId: 'trace-123' },
        metadata: { agentId: 'agent-123', normalField: 'visible-data' },
      };

      await exporter.exportEvent({
        type: 'span_started',
        span: mockSpan as any,
      });

      // Should log with proper formatting (no filtering happens in exporter anymore)
      expect(logger.info).toHaveBeenCalledWith('🚀 SPAN_STARTED');
      expect(logger.info).toHaveBeenCalledWith('   Type: agent_run');
      expect(logger.info).toHaveBeenCalledWith('   Name: test-span');
      expect(logger.info).toHaveBeenCalledWith('   ID: test-span-1');
      expect(logger.info).toHaveBeenCalledWith('   Trace ID: trace-123');

      // Check that metadata is logged (filtering happens at processor level now)
      const metadataCall = logger.info.mock.calls.find(call => call[0].includes('Metadata:'));
      expect(metadataCall).toBeDefined();
      expect(metadataCall![0]).toContain('visible-data');
    });

    it('should handle unknown events', async () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };

      const exporter = new DefaultConsoleExporter(logger as any);

      await exporter.exportEvent({
        type: 'unknown_event' as any,
        span: {} as any,
      });

      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('❓ UNKNOWN_EVENT:'));
    });
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
          metadata: {
            agentId: 'agent-123',
            password: 'secret123', // Should be redacted
            Token: 'bearer-token', // Should be redacted (case insensitive)
            SECRET: 'top-secret', // Should be redacted (case insensitive)
            apiKey: 'api-key-456', // Should be redacted
            AUTHORIZATION: 'Basic xyz', // Should be redacted (case insensitive)
            sessionId: 'session-789', // Should be redacted
            normalField: 'visible-data', // Should NOT be redacted
          },
          aiTelemetry: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const metadata = filtered!.metadata;

        // Check that sensitive fields are redacted
        expect(metadata['password']).toBe('[REDACTED]');
        expect(metadata['Token']).toBe('[REDACTED]');
        expect(metadata['SECRET']).toBe('[REDACTED]');
        expect(metadata['apiKey']).toBe('[REDACTED]');
        expect(metadata['AUTHORIZATION']).toBe('[REDACTED]');
        expect(metadata['sessionId']).toBe('[REDACTED]');

        // Check that normal fields are visible
        expect(metadata['normalField']).toBe('visible-data');
        expect(metadata['agentId']).toBe('agent-123'); // agentId is part of AgentRunMetadata
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
          metadata: {
            agentId: 'agent-123',
            password: 'should-be-visible', // NOT in custom list
            customSecret: 'should-be-hidden', // In custom list
            InternalId: 'should-be-hidden', // In custom list (case insensitive)
            publicData: 'visible-data',
          },
          aiTelemetry: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const metadata = filtered!.metadata;

        // Custom fields should be redacted
        expect(metadata['customSecret']).toBe('[REDACTED]');
        expect(metadata['InternalId']).toBe('[REDACTED]');

        // Default sensitive fields should be visible (not in custom list)
        expect(metadata['password']).toBe('should-be-visible');
        expect(metadata['publicData']).toBe('visible-data');
        expect(metadata['agentId']).toBe('agent-123'); // agentId is part of AgentRunMetadata
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
          metadata: {
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
          aiTelemetry: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        const metadata = filtered!.metadata;

        // All sensitive fields should be redacted at any level
        expect(metadata['apiKey']).toBe('[REDACTED]');
        expect(metadata['config']['apiKey']).toBe('[REDACTED]');
        expect(metadata['config']['auth']['token']).toBe('[REDACTED]');
        expect(metadata['headers']['Authorization']).toBe('[REDACTED]');
        expect(metadata['results'][0]['secret']).toBe('[REDACTED]');
        expect(metadata['results'][1]['password']).toBe('[REDACTED]');

        // Non-sensitive fields should be visible
        expect(metadata['model']).toBe('gpt-4');
        expect(metadata['config']['temperature']).toBe(0.7);
        expect(metadata['config']['auth']['userId']).toBe('user123');
        expect(metadata['headers']['Content-Type']).toBe('application/json');
        expect(metadata['results'][0]['data']).toBe('visible');
        expect(metadata['results'][1]['value']).toBe(42);
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
          metadata: circularObj,
          aiTelemetry: {} as any,
          end: () => {},
          error: () => {},
          update: () => {},
          createChildSpan: () => ({}) as any,
        } as any;

        const filtered = processor.process(mockSpan);
        expect(filtered).not.toBeNull();

        const metadata = filtered!.metadata;
        expect(metadata['apiKey']).toBe('[REDACTED]');
        expect(metadata['self']).toBe('[Circular Reference]');
        expect(metadata['name']).toBe('test');
      });
    });

    describe('Integration Tests', () => {
      it('should automatically filter sensitive data in default telemetry', () => {
        const telemetry = new DefaultAITelemetry({
          name: 'test-telemetry',
          exporters: [testExporter],
        });

        const span = telemetry.startSpan(AISpanType.AGENT_RUN, 'test-agent', {
          agentId: 'agent-123',
          instructions: 'Test agent',
        } as any);

        // Update span with non-standard field that should be filtered
        span.update({ apiKey: 'secret-key-456' } as any);

        span.end();

        // Verify events were exported (3 events: start + update + end)
        expect(testExporter.events).toHaveLength(3);

        // Check that the exported span has filtered metadata
        const startSpan = testExporter.events[0].span;
        expect(startSpan.metadata['agentId']).toBe('agent-123');
        expect(startSpan.metadata['instructions']).toBe('Test agent');

        // Check the updated span for the filtered field
        const updatedSpan = testExporter.events[1].span; // span_updated event
        expect(updatedSpan.metadata['apiKey']).toBe('[REDACTED]');
      });
    });
  });
});
