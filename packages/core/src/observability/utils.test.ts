/**
 * getOrCreateSpan Unit Tests
 *
 * Tests for the getOrCreateSpan utility function that creates or retrieves child spans
 * from existing tracing context or starts new traces.
 */

import { describe, expect, it, vi } from 'vitest';
import { getOrCreateSpan } from './utils';

describe('getOrCreateSpan', () => {
  describe('child span creation (tracingContext.currentSpan exists)', () => {
    it('should pass requestContext to createChildSpan', () => {
      const mockRequestContext = { get: vi.fn(), set: vi.fn() };
      const mockChildSpan = { id: 'child-span' };
      const createChildSpan = vi.fn().mockReturnValue(mockChildSpan);

      const result = getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        tracingContext: { currentSpan: { createChildSpan } as any },
        requestContext: mockRequestContext as any,
      });

      expect(createChildSpan).toHaveBeenCalledTimes(1);
      expect(createChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: mockRequestContext,
        }),
      );
      expect(result).toBe(mockChildSpan);
    });

    it('should pass type, attributes, and metadata to createChildSpan', () => {
      const createChildSpan = vi.fn().mockReturnValue({ id: 'child-span' });

      getOrCreateSpan({
        type: 'TOOL_CALL' as any,
        name: 'test-tool',
        attributes: { toolId: 'tool-1' } as any,
        metadata: { custom: 'value' },
        tracingContext: { currentSpan: { createChildSpan } as any },
      });

      expect(createChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TOOL_CALL',
          name: 'test-tool',
          attributes: { toolId: 'tool-1' },
          metadata: { custom: 'value' },
        }),
      );
    });

    it('should merge tracingOptions.metadata into metadata for child spans', () => {
      const createChildSpan = vi.fn().mockReturnValue({ id: 'child-span' });

      getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        metadata: { existing: 'value' },
        tracingOptions: { metadata: { extra: 'data' } },
        tracingContext: { currentSpan: { createChildSpan } as any },
      });

      expect(createChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { existing: 'value', extra: 'data' },
        }),
      );
    });

    it('should handle undefined requestContext gracefully for child spans', () => {
      const createChildSpan = vi.fn().mockReturnValue({ id: 'child-span' });

      getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        tracingContext: { currentSpan: { createChildSpan } as any },
        // No requestContext provided
      });

      expect(createChildSpan).toHaveBeenCalledTimes(1);
      expect(createChildSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: undefined,
        }),
      );
    });
  });

  describe('root span creation (no tracingContext.currentSpan)', () => {
    it('should return undefined when no mastra instance is provided', () => {
      const result = getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
      });

      expect(result).toBeUndefined();
    });

    it('should pass requestContext to getSelectedInstance and startSpan', () => {
      const mockRequestContext = { get: vi.fn(), set: vi.fn() };
      const mockSpan = { id: 'root-span' };
      const startSpan = vi.fn().mockReturnValue(mockSpan);
      const getSelectedInstance = vi.fn().mockReturnValue({ startSpan });

      const result = getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        requestContext: mockRequestContext as any,
        mastra: {
          observability: { getSelectedInstance },
        } as any,
      });

      expect(getSelectedInstance).toHaveBeenCalledWith({ requestContext: mockRequestContext });
      expect(startSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          requestContext: mockRequestContext,
          customSamplerOptions: {
            requestContext: mockRequestContext,
            metadata: {},
          },
        }),
      );
      expect(result).toBe(mockSpan);
    });
  });

  describe('no tracing context', () => {
    it('should return undefined when tracingContext is undefined', () => {
      const result = getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        tracingContext: undefined,
      });

      expect(result).toBeUndefined();
    });

    it('should return undefined when tracingContext.currentSpan is undefined', () => {
      const result = getOrCreateSpan({
        type: 'AGENT_RUN' as any,
        name: 'test-agent',
        attributes: { agentId: 'agent-1' } as any,
        tracingContext: { currentSpan: undefined as any },
      });

      expect(result).toBeUndefined();
    });
  });
});
