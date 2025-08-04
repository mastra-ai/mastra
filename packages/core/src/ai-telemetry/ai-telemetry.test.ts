import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraError } from '../error';
import { DefaultAITelemetry, DefaultConsoleExporter } from './default';
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

      expect(agentSpan.id).toMatch(/^span-\d+-[a-z0-9]+$/);
      expect(agentSpan.name).toBe('test-agent');
      expect(agentSpan.type).toBe(AISpanType.AGENT_RUN);
      expect(agentSpan.metadata.agentId).toBe('agent-123');
      expect(agentSpan.startTime).toBeInstanceOf(Date);
      expect(agentSpan.endTime).toBeUndefined();
      expect(agentSpan.trace).toBe(agentSpan); // Root span is its own trace
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

      expect(toolSpan.id).toMatch(/^span-\d+-[a-z0-9]+$/);
      expect(toolSpan.type).toBe(AISpanType.TOOL_CALL);
      expect(toolSpan.metadata.toolId).toBe('tool-456');
      expect(toolSpan.trace).toBe(agentSpan); // Child inherits trace from parent
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

      // Update span
      span.update({ usage: { totalTokens: 100 } });

      // Should emit span_updated
      expect(testExporter.events).toHaveLength(2);
      expect(testExporter.events[1].type).toBe('span_updated');
      expect(testExporter.events[1].span.metadata.usage?.totalTokens).toBe(100);

      // End span
      span.end({ usage: { totalTokens: 150 } });

      // Should emit span_ended
      expect(testExporter.events).toHaveLength(3);
      expect(testExporter.events[2].type).toBe('span_ended');
      expect(testExporter.events[2].span.endTime).toBeInstanceOf(Date);
      expect(testExporter.events[2].span.metadata.usage?.totalTokens).toBe(150);
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

      expect(span.id).toMatch(/^span-\d+-[a-z0-9]+$/); // Real span created
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
      expect(span1.id).toMatch(/^span-\d+-[a-z0-9]+$/);

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

      const span = telemetry.startSpan(AISpanType.GENERIC, 'test-span', {});

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
      expect(config.settings?.includeIO).toBe(true); // Default
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
        trace: { id: 'trace-1' },
        metadata: { agentId: 'agent-123', apiKey: 'secret-key' },
      };

      await exporter.exportEvent({
        type: 'span_started',
        span: mockSpan as any,
      });

      // Should log with proper formatting and redact sensitive data
      expect(logger.info).toHaveBeenCalledWith('🚀 SPAN_STARTED');
      expect(logger.info).toHaveBeenCalledWith('   Type: agent_run');
      expect(logger.info).toHaveBeenCalledWith('   Name: test-span');
      expect(logger.info).toHaveBeenCalledWith('   ID: test-span-1');

      // Check that sensitive data is redacted
      const metadataCall = logger.info.mock.calls.find(call => call[0].includes('[REDACTED]'));
      expect(metadataCall).toBeDefined();
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
});
