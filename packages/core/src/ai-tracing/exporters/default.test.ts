import { describe, it, expect, vi } from 'vitest';
import { DefaultExporter } from './default';
import { AISpanType, AITracingEventType } from '../types';
import type { LLMGenerationAttributes, WorkflowStepAttributes } from '../types';

// Mock Mastra and logger
const mockMastra = {
  getStorage: vi.fn(),
} as any;

const mockLogger = {
  warn: vi.fn(),
  info: vi.fn(),
} as any;

describe('DefaultExporter', () => {
  describe('serializeAttributes', () => {
    it('should serialize LLM generation attributes with dates', () => {
      const exporter = new DefaultExporter(mockMastra, mockLogger);

      const mockSpan = {
        id: 'span-1',
        type: AISpanType.LLM_GENERATION,
        attributes: {
          model: 'gpt-4',
          provider: 'openai',
          usage: {
            promptTokens: 10,
            completionTokens: 20,
            totalTokens: 30,
          },
          parameters: {
            temperature: 0.7,
            maxTokens: 1000,
          },
        } as LLMGenerationAttributes,
      } as any;

      const result = (exporter as any).serializeAttributes(mockSpan);

      expect(result).toEqual({
        model: 'gpt-4',
        provider: 'openai',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        parameters: {
          temperature: 0.7,
          maxTokens: 1000,
        },
      });
    });

    it('should serialize workflow step attributes', () => {
      const exporter = new DefaultExporter(mockMastra, mockLogger);

      const mockSpan = {
        id: 'span-2',
        type: AISpanType.WORKFLOW_STEP,
        attributes: {
          stepId: 'step-1',
          status: 'success',
        } as WorkflowStepAttributes,
      } as any;

      const result = (exporter as any).serializeAttributes(mockSpan);

      expect(result).toEqual({
        stepId: 'step-1',
        status: 'success',
      });
    });

    it('should handle Date objects in attributes', () => {
      const exporter = new DefaultExporter(mockMastra, mockLogger);
      const testDate = new Date('2023-12-01T10:00:00Z');

      const mockSpan = {
        id: 'span-3',
        type: AISpanType.WORKFLOW_SLEEP,
        attributes: {
          untilDate: testDate,
          durationMs: 5000,
        },
      } as any;

      const result = (exporter as any).serializeAttributes(mockSpan);

      expect(result).toEqual({
        untilDate: '2023-12-01T10:00:00.000Z',
        durationMs: 5000,
      });
    });

    it('should return null for undefined attributes', () => {
      const exporter = new DefaultExporter(mockMastra, mockLogger);

      const mockSpan = {
        id: 'span-4',
        type: AISpanType.GENERIC,
        attributes: undefined,
      } as any;

      const result = (exporter as any).serializeAttributes(mockSpan);

      expect(result).toBeNull();
    });

    it('should handle serialization errors gracefully', () => {
      const exporter = new DefaultExporter(mockMastra, mockLogger);

      // Create an object that will cause JSON.stringify to throw
      const circularObj = {} as any;
      circularObj.self = circularObj;

      const mockSpan = {
        id: 'span-5',
        type: AISpanType.TOOL_CALL,
        attributes: {
          circular: circularObj,
        },
      } as any;

      const result = (exporter as any).serializeAttributes(mockSpan);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to serialize span attributes, storing as null',
        expect.objectContaining({
          spanId: 'span-5',
          spanType: AISpanType.TOOL_CALL,
        }),
      );
    });
  });
});
