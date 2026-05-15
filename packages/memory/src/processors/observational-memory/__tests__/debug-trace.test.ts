import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OM_DEBUG_TRACE_ENV, withOmDebugSpan } from '../debug-trace';

describe('withOmDebugSpan', () => {
  const originalEnv = process.env[OM_DEBUG_TRACE_ENV];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env[OM_DEBUG_TRACE_ENV];
    } else {
      process.env[OM_DEBUG_TRACE_ENV] = originalEnv;
    }
  });

  describe('when MASTRA_OM_DEBUG_TRACE is unset', () => {
    beforeEach(() => {
      delete process.env[OM_DEBUG_TRACE_ENV];
    });

    it('returns the callback result without creating a span', async () => {
      const fn = vi.fn().mockResolvedValue('result');
      const currentSpan = { createChildSpan: vi.fn() };

      const result = await withOmDebugSpan('om.step.prepare', { tracingContext: { currentSpan } } as any, fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(currentSpan.createChildSpan).not.toHaveBeenCalled();
    });

    it('propagates rejections without touching span APIs', async () => {
      const err = new Error('boom');
      await expect(withOmDebugSpan('om.getStatus', undefined, () => Promise.reject(err))).rejects.toBe(err);
    });
  });

  describe('when MASTRA_OM_DEBUG_TRACE=1', () => {
    beforeEach(() => {
      process.env[OM_DEBUG_TRACE_ENV] = '1';
    });

    it('runs the callback directly when there is no current span', async () => {
      const fn = vi.fn().mockResolvedValue(42);
      const result = await withOmDebugSpan('om.getOrCreateRecord', undefined, fn);
      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('creates a child span and ends it on success', async () => {
      const child = {
        executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
        end: vi.fn(),
        error: vi.fn(),
      };
      const currentSpan = { createChildSpan: vi.fn().mockReturnValue(child) };

      const result = await withOmDebugSpan('om.step.prepare', { tracingContext: { currentSpan } } as any, () =>
        Promise.resolve('ok'),
      );

      expect(result).toBe('ok');
      expect(currentSpan.createChildSpan).toHaveBeenCalledTimes(1);
      expect(currentSpan.createChildSpan.mock.calls[0][0].name).toBe('om.step.prepare');
      expect(child.executeInContext).toHaveBeenCalledTimes(1);
      expect(child.end).toHaveBeenCalledTimes(1);
      expect(child.error).not.toHaveBeenCalled();
    });

    it('records error with endSpan: true when the callback throws', async () => {
      const child = {
        executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
        end: vi.fn(),
        error: vi.fn(),
      };
      const currentSpan = { createChildSpan: vi.fn().mockReturnValue(child) };

      const err = new Error('downstream');
      await expect(
        withOmDebugSpan('om.getStatus', { tracingContext: { currentSpan } } as any, () => Promise.reject(err)),
      ).rejects.toBe(err);

      expect(child.error).toHaveBeenCalledTimes(1);
      expect(child.error.mock.calls[0][0].error).toBe(err);
      expect(child.error.mock.calls[0][0].endSpan).toBe(true);
      expect(child.end).not.toHaveBeenCalled();
    });

    it('also accepts the literal "true" as the opt-in value', async () => {
      process.env[OM_DEBUG_TRACE_ENV] = 'true';
      const child = {
        executeInContext: vi.fn(async (fn: () => Promise<unknown>) => fn()),
        end: vi.fn(),
        error: vi.fn(),
      };
      const currentSpan = { createChildSpan: vi.fn().mockReturnValue(child) };

      await withOmDebugSpan('om.step.prepare', { tracingContext: { currentSpan } } as any, () => Promise.resolve());
      expect(currentSpan.createChildSpan).toHaveBeenCalledTimes(1);
    });
  });
});
