import { describe, it, expect, vi } from 'vitest';
import { normalizeModelOutput, computeToolModelOutput } from './model-output';
import { EntityType, SpanType } from '../observability';

describe('normalizeModelOutput', () => {
  describe('passthrough cases', () => {
    it('should return null/undefined as-is', () => {
      expect(normalizeModelOutput(null)).toBe(null);
      expect(normalizeModelOutput(undefined)).toBe(undefined);
    });

    it('should return primitive values as-is', () => {
      expect(normalizeModelOutput('string')).toBe('string');
      expect(normalizeModelOutput(42)).toBe(42);
      expect(normalizeModelOutput(true)).toBe(true);
    });

    it('should return non-content objects as-is', () => {
      const obj = { type: 'text', value: 'hello' };
      expect(normalizeModelOutput(obj)).toEqual(obj);
    });

    it('should return content without array value as-is', () => {
      const obj = { type: 'content', value: 'not an array' };
      expect(normalizeModelOutput(obj)).toEqual(obj);
    });
  });

  describe('media type conversions', () => {
    it('should convert image/* mediaType to image-data', () => {
      const input = {
        type: 'content',
        value: [
          { type: 'media', data: 'base64png', mediaType: 'image/png' },
          { type: 'media', data: 'base64jpg', mediaType: 'image/jpeg' },
        ],
      };

      const result = normalizeModelOutput(input);

      expect(result).toEqual({
        type: 'content',
        value: [
          { type: 'image-data', data: 'base64png', mediaType: 'image/png' },
          { type: 'image-data', data: 'base64jpg', mediaType: 'image/jpeg' },
        ],
      });
    });

    it('should convert non-image mediaType to file-data', () => {
      const input = {
        type: 'content',
        value: [
          { type: 'media', data: 'base64pdf', mediaType: 'application/pdf' },
          { type: 'media', data: 'base64txt', mediaType: 'text/plain' },
        ],
      };

      const result = normalizeModelOutput(input);

      expect(result).toEqual({
        type: 'content',
        value: [
          { type: 'file-data', data: 'base64pdf', mediaType: 'application/pdf' },
          { type: 'file-data', data: 'base64txt', mediaType: 'text/plain' },
        ],
      });
    });

    it('should leave non-media parts untouched', () => {
      const input = {
        type: 'content',
        value: [
          { type: 'text', text: 'caption' },
          { type: 'media', data: 'base64png', mediaType: 'image/png' },
          { type: 'other', foo: 'bar' },
        ],
      };

      const result = normalizeModelOutput(input);

      expect(result).toEqual({
        type: 'content',
        value: [
          { type: 'text', text: 'caption' },
          { type: 'image-data', data: 'base64png', mediaType: 'image/png' },
          { type: 'other', foo: 'bar' },
        ],
      });
    });
  });

  describe('malformed entries', () => {
    it('should handle null/undefined in value array', () => {
      const input = {
        type: 'content',
        value: [null, undefined, { type: 'media', data: 'abc', mediaType: 'image/png' }],
      };

      const result = normalizeModelOutput(input);

      expect(result).toEqual({
        type: 'content',
        value: [null, undefined, { type: 'image-data', data: 'abc', mediaType: 'image/png' }],
      });
    });

    it('should handle non-objects in value array', () => {
      const input = {
        type: 'content',
        value: ['string', 42, { type: 'media', data: 'abc', mediaType: 'image/png' }],
      };

      const result = normalizeModelOutput(input);

      expect(result).toEqual({
        type: 'content',
        value: ['string', 42, { type: 'image-data', data: 'abc', mediaType: 'image/png' }],
      });
    });
  });
});

describe('computeToolModelOutput', () => {
  describe('returns undefined', () => {
    it('should return undefined when no tool is provided', async () => {
      const result = await computeToolModelOutput({
        tool: undefined,
        result: { foo: 'bar' },
        toolName: 'test-tool',
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined when tool has no toModelOutput', async () => {
      const result = await computeToolModelOutput({
        tool: {},
        result: { foo: 'bar' },
        toolName: 'test-tool',
      });
      expect(result).toBeUndefined();
    });

    it('should return undefined when result is null', async () => {
      const tool = { toModelOutput: vi.fn() };
      const result = await computeToolModelOutput({
        tool,
        result: null,
        toolName: 'test-tool',
      });
      expect(result).toBeUndefined();
      expect(tool.toModelOutput).not.toHaveBeenCalled();
    });

    it('should return undefined when result is undefined', async () => {
      const tool = { toModelOutput: vi.fn() };
      const result = await computeToolModelOutput({
        tool,
        result: undefined,
        toolName: 'test-tool',
      });
      expect(result).toBeUndefined();
      expect(tool.toModelOutput).not.toHaveBeenCalled();
    });
  });

  describe('successful execution', () => {
    it('should call toModelOutput and return result', async () => {
      const toModelOutput = vi.fn().mockResolvedValue({ type: 'text', value: 'transformed' });
      const tool = { toModelOutput };

      const result = await computeToolModelOutput({
        tool,
        result: { foo: 'bar' },
        toolName: 'test-tool',
        toolCallId: 'call-123',
      });

      expect(toModelOutput).toHaveBeenCalledWith({ foo: 'bar' });
      expect(result).toEqual({ type: 'text', value: 'transformed' });
    });

    it('should normalize media types in the result', async () => {
      const toModelOutput = vi.fn().mockResolvedValue({
        type: 'content',
        value: [{ type: 'media', data: 'abc', mediaType: 'image/png' }],
      });
      const tool = { toModelOutput };

      const result = await computeToolModelOutput({
        tool,
        result: { foo: 'bar' },
        toolName: 'test-tool',
      });

      expect(result).toEqual({
        type: 'content',
        value: [{ type: 'image-data', data: 'abc', mediaType: 'image/png' }],
      });
    });

    it('should work without observabilityContext (no span creation)', async () => {
      const toModelOutput = vi.fn().mockResolvedValue({ type: 'text', value: 'test' });
      const tool = { toModelOutput };

      const result = await computeToolModelOutput({
        tool,
        result: { input: 'data' },
        toolName: 'test-tool',
        observabilityContext: undefined,
      });

      expect(result).toEqual({ type: 'text', value: 'test' });
      expect(toModelOutput).toHaveBeenCalledWith({ input: 'data' });
    });
  });

  describe('observability span creation', () => {
    it('should create MAPPING span when observabilityContext is provided', async () => {
      const toModelOutput = vi.fn().mockResolvedValue({ type: 'text', value: 'test' });
      const tool = { toModelOutput };

      const mockSpan = {
        createChildSpan: vi.fn().mockReturnValue({
          end: vi.fn(),
          error: vi.fn(),
        }),
      };

      const observabilityContext = {
        tracingContext: {
          currentSpan: mockSpan,
        },
      } as any;

      await computeToolModelOutput({
        tool,
        result: { input: 'data' },
        toolName: 'test-tool',
        toolCallId: 'call-456',
        observabilityContext,
      });

      expect(mockSpan.createChildSpan).toHaveBeenCalledWith({
        type: SpanType.MAPPING,
        name: "tool output mapping: 'test-tool'",
        entityType: EntityType.TOOL,
        entityId: 'test-tool',
        entityName: 'test-tool',
        input: { input: 'data' },
        attributes: {
          mappingType: 'toModelOutput',
          toolCallId: 'call-456',
        },
      });
    });

    it('should end span with output on success', async () => {
      const toModelOutput = vi.fn().mockResolvedValue({ type: 'text', value: 'success' });
      const tool = { toModelOutput };

      const mappingSpan = {
        end: vi.fn(),
        error: vi.fn(),
      };

      const mockSpan = {
        createChildSpan: vi.fn().mockReturnValue(mappingSpan),
      };

      const observabilityContext = {
        tracingContext: {
          currentSpan: mockSpan,
        },
      } as any;

      await computeToolModelOutput({
        tool,
        result: { input: 'data' },
        toolName: 'test-tool',
        observabilityContext,
      });

      expect(mappingSpan.end).toHaveBeenCalledWith({
        output: { type: 'text', value: 'success' },
      });
      expect(mappingSpan.error).not.toHaveBeenCalled();
    });

    it('should end span with error on failure', async () => {
      const error = new Error('toModelOutput failed');
      const toModelOutput = vi.fn().mockRejectedValue(error);
      const tool = { toModelOutput };

      const mappingSpan = {
        end: vi.fn(),
        error: vi.fn(),
      };

      const mockSpan = {
        createChildSpan: vi.fn().mockReturnValue(mappingSpan),
      };

      const observabilityContext = {
        tracingContext: {
          currentSpan: mockSpan,
        },
      } as any;

      await expect(
        computeToolModelOutput({
          tool,
          result: { input: 'data' },
          toolName: 'test-tool',
          observabilityContext,
        }),
      ).rejects.toThrow('toModelOutput failed');

      expect(mappingSpan.error).toHaveBeenCalledWith({
        error,
        endSpan: true,
      });
      expect(mappingSpan.end).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when toModelOutput throws', async () => {
      const error = new Error('Transform failed');
      const toModelOutput = vi.fn().mockRejectedValue(error);
      const tool = { toModelOutput };

      await expect(
        computeToolModelOutput({
          tool,
          result: { foo: 'bar' },
          toolName: 'test-tool',
        }),
      ).rejects.toThrow('Transform failed');
    });
  });
});
