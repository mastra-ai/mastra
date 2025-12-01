/**
 * Unit tests for OtelBridge
 *
 * Note: Full integration tests with real OTEL infrastructure are in
 * observability/_examples/agent-hub/src/integration.test.ts
 *
 * These unit tests focus on the bridge's core logic and API surface.
 */

import type { CreateSpanOptions } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';
import { describe, expect, it } from 'vitest';
import { OtelBridge } from './bridge.js';

describe('OtelBridge', () => {
  describe('createSpan', () => {
    it('should return spanIds with valid format when creating root span', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const result = bridge.createSpan(options);

      expect(result).toBeDefined();
      expect(result?.spanId).toBeDefined();
      expect(result?.traceId).toBeDefined();
      // OTEL span IDs are 16 hex chars, trace IDs are 32 hex chars
      expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(result?.traceId).toMatch(/^[0-9a-f]{32}$/);

      bridge.shutdown();
    });

    it('should handle errors gracefully and return undefined on failure', () => {
      const bridge = new OtelBridge();

      // Pass invalid options to trigger error path
      const result = bridge.createSpan(null as any);

      expect(result).toBeUndefined();

      bridge.shutdown();
    });
  });

  describe('executeInContext', () => {
    it('should execute function when span exists', async () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = await bridge.executeInContext(spanIds!.spanId, async () => {
        executed = true;
        return 'test-result';
      });

      expect(executed).toBe(true);
      expect(result).toBe('test-result');

      bridge.shutdown();
    });

    it('should execute function even when span not found', async () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = await bridge.executeInContext('non-existent-span', async () => {
        executed = true;
        return 'still-works';
      });

      expect(executed).toBe(true);
      expect(result).toBe('still-works');

      bridge.shutdown();
    });
  });

  describe('executeInContextSync', () => {
    it('should execute sync function when span exists', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = bridge.executeInContextSync(spanIds!.spanId, () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });

    it('should execute sync function even when span not found', () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = bridge.executeInContextSync('non-existent-span', () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should complete successfully', async () => {
      const bridge = new OtelBridge();

      // Create a span
      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      bridge.createSpan(options);

      // Shutdown should not throw
      await expect(bridge.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('bridge name', () => {
    it('should have name "otel"', () => {
      const bridge = new OtelBridge();
      expect(bridge.name).toBe('otel');
      bridge.shutdown();
    });
  });
});
