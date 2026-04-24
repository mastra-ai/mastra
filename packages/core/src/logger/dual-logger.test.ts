import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LoggerContext } from '../observability/types/logging';
import * as utils from '../observability/utils';
import { DualLogger } from './dual-logger';
import type { IMastraLogger } from './logger';

function createMockLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trackException: vi.fn(),
    getTransports: vi.fn(() => new Map()),
    listLogs: vi.fn(async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false })),
    listLogsByRunId: vi.fn(async () => ({ logs: [], total: 0, page: 1, perPage: 100, hasMore: false })),
  };
}

function createMockLoggerVNext(): LoggerContext {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}

describe('DualLogger', () => {
  let inner: IMastraLogger;
  let vnext: LoggerContext;

  beforeEach(() => {
    inner = createMockLogger();
    vnext = createMockLoggerVNext();
  });

  describe('forwarding to both loggers', () => {
    it.each(['debug', 'info', 'warn', 'error'] as const)('%s forwards to inner and loggerVNext', level => {
      const dual = new DualLogger(inner, () => vnext);
      dual[level]('test message', { key: 'value' });

      expect(inner[level]).toHaveBeenCalledWith('test message', { key: 'value' });
      expect(vnext[level]).toHaveBeenCalledWith('test message', { key: 'value' });
    });
  });

  describe('when loggerVNext is not set', () => {
    it('only forwards to inner logger', () => {
      const dual = new DualLogger(inner);
      dual.info('test message', { key: 'value' });

      expect(inner.info).toHaveBeenCalledWith('test message', { key: 'value' });
      expect(vnext.info).not.toHaveBeenCalled();
    });

    it('only forwards to inner logger when getter returns undefined', () => {
      const dual = new DualLogger(inner, () => undefined);
      dual.info('test message', { key: 'value' });

      expect(inner.info).toHaveBeenCalledWith('test message', { key: 'value' });
      expect(vnext.info).not.toHaveBeenCalled();
    });
  });

  describe('setLoggerVNext', () => {
    it('connects loggerVNext after construction', () => {
      const dual = new DualLogger(inner);
      dual.info('before');
      expect(vnext.info).not.toHaveBeenCalled();

      dual.setLoggerVNext(() => vnext);
      dual.info('after', { key: 'value' });
      expect(vnext.info).toHaveBeenCalledWith('after', { key: 'value' });
    });

    it('uses lazy getter — resolves loggerVNext at call time', () => {
      let current: LoggerContext | undefined;
      const dual = new DualLogger(inner, () => current);

      dual.info('before');
      expect(vnext.info).not.toHaveBeenCalled();

      current = vnext;
      dual.info('after', { key: 'value' });
      expect(vnext.info).toHaveBeenCalledWith('after', { key: 'value' });
    });
  });

  describe('args adaptation', () => {
    it('extracts first object arg and collects extra args for loggerVNext', () => {
      const dual = new DualLogger(inner, () => vnext);
      dual.info('msg', { a: 1 }, 'extra', { b: 2 });

      // Inner gets all args as-is
      expect(inner.info).toHaveBeenCalledWith('msg', { a: 1 }, 'extra', { b: 2 });
      // VNext gets normalized: first object as base, remaining non-error/non-object as args
      expect(vnext.info).toHaveBeenCalledWith('msg', { a: 1, args: ['extra', { b: 2 }] });
    });

    it('forwards with empty object when no object args', () => {
      const dual = new DualLogger(inner, () => vnext);
      dual.info('string only');

      expect(inner.info).toHaveBeenCalledWith('string only');
      expect(vnext.info).toHaveBeenCalledWith('string only', {});
    });

    it('skips null args when finding data object', () => {
      const dual = new DualLogger(inner, () => vnext);
      dual.info('msg', null, { actual: 'data' });

      expect(vnext.info).toHaveBeenCalledWith('msg', { actual: 'data', args: [null] });
    });

    it('serializes Error args into structured error data', () => {
      const dual = new DualLogger(inner, () => vnext);
      const err = new Error('boom');
      dual.error('failed', err);

      expect(inner.error).toHaveBeenCalledWith('failed', err);
      expect(vnext.error).toHaveBeenCalledWith('failed', {
        error: { name: 'Error', message: 'boom', stack: err.stack },
      });
    });

    it('merges object data and Error args', () => {
      const dual = new DualLogger(inner, () => vnext);
      const err = new Error('boom');
      dual.error('failed', { context: 'test' }, err);

      expect(vnext.error).toHaveBeenCalledWith('failed', {
        context: 'test',
        error: { name: 'Error', message: 'boom', stack: err.stack },
      });
    });
  });

  describe('delegation methods', () => {
    it('trackException delegates to inner and forwards structured data to loggerVNext', () => {
      const dual = new DualLogger(inner, () => vnext);
      const error = {
        message: 'Something failed',
        id: 'AGENT_GENERATE_FAILED',
        domain: 'AGENT',
        category: 'USER',
        details: { agentId: 'test-agent' },
        cause: { message: 'underlying cause' },
      } as any;
      dual.trackException(error);

      expect(inner.trackException).toHaveBeenCalledWith(error, undefined);
      expect(vnext.error).toHaveBeenCalledWith('Something failed', {
        errorId: 'AGENT_GENERATE_FAILED',
        domain: 'AGENT',
        category: 'USER',
        details: { agentId: 'test-agent' },
        cause: 'underlying cause',
      });
    });

    it('getTransports delegates to inner', () => {
      const transports = new Map();
      (inner.getTransports as ReturnType<typeof vi.fn>).mockReturnValue(transports);

      const dual = new DualLogger(inner, () => vnext);
      expect(dual.getTransports()).toBe(transports);
    });

    it('listLogs delegates to inner', async () => {
      const result = { logs: [], total: 0, page: 1, perPage: 100, hasMore: false };
      (inner.listLogs as ReturnType<typeof vi.fn>).mockResolvedValue(result);

      const dual = new DualLogger(inner, () => vnext);
      const logs = await dual.listLogs('transport1');
      expect(logs).toBe(result);
      expect(inner.listLogs).toHaveBeenCalledWith('transport1', undefined);
    });

    it('listLogsByRunId delegates to inner', async () => {
      const result = { logs: [], total: 0, page: 1, perPage: 100, hasMore: false };
      (inner.listLogsByRunId as ReturnType<typeof vi.fn>).mockResolvedValue(result);

      const dual = new DualLogger(inner, () => vnext);
      const args = { transportId: 'transport1', runId: 'run1' };
      const logs = await dual.listLogsByRunId(args);
      expect(logs).toBe(result);
      expect(inner.listLogsByRunId).toHaveBeenCalledWith(args);
    });
  });

  describe('error isolation', () => {
    it('loggerVNext errors do not break the inner logger', () => {
      const throwingVnext: LoggerContext = {
        debug: vi.fn(() => {
          throw new Error('vnext boom');
        }),
        info: vi.fn(() => {
          throw new Error('vnext boom');
        }),
        warn: vi.fn(() => {
          throw new Error('vnext boom');
        }),
        error: vi.fn(() => {
          throw new Error('vnext boom');
        }),
        fatal: vi.fn(() => {
          throw new Error('vnext boom');
        }),
      };

      const dual = new DualLogger(inner, () => throwingVnext);

      // Should not throw
      expect(() => dual.info('test')).not.toThrow();
      expect(inner.info).toHaveBeenCalledWith('test');
    });
  });

  describe('span-aware forwarding', () => {
    it('uses span-correlated loggerVNext when span is in async context', () => {
      const correlatedVnext = createMockLoggerVNext();
      const mockSpan = {
        observabilityInstance: {
          getLoggerContext: vi.fn(() => correlatedVnext),
        },
      };

      vi.spyOn(utils, 'resolveCurrentSpan').mockReturnValue(mockSpan as any);

      const dual = new DualLogger(inner, () => vnext);
      dual.info('inside span', { key: 'value' });

      // Should use span-correlated loggerVNext, NOT the global one
      expect(correlatedVnext.info).toHaveBeenCalledWith('inside span', { key: 'value' });
      expect(vnext.info).not.toHaveBeenCalled();
      // Inner logger always fires
      expect(inner.info).toHaveBeenCalledWith('inside span', { key: 'value' });

      vi.restoreAllMocks();
    });

    it('falls back to global loggerVNext when no span in context', () => {
      vi.spyOn(utils, 'resolveCurrentSpan').mockReturnValue(undefined);

      const dual = new DualLogger(inner, () => vnext);
      dual.info('no span', { key: 'value' });

      expect(vnext.info).toHaveBeenCalledWith('no span', { key: 'value' });
      expect(inner.info).toHaveBeenCalledWith('no span', { key: 'value' });

      vi.restoreAllMocks();
    });

    it('falls back to global loggerVNext when span has no observabilityInstance', () => {
      const mockSpan = { observabilityInstance: undefined };
      vi.spyOn(utils, 'resolveCurrentSpan').mockReturnValue(mockSpan as any);

      const dual = new DualLogger(inner, () => vnext);
      dual.info('no instance', { key: 'value' });

      expect(vnext.info).toHaveBeenCalledWith('no instance', { key: 'value' });

      vi.restoreAllMocks();
    });

    it('trackException uses span-correlated loggerVNext when available', () => {
      const correlatedVnext = createMockLoggerVNext();
      const mockSpan = {
        observabilityInstance: {
          getLoggerContext: vi.fn(() => correlatedVnext),
        },
      };

      vi.spyOn(utils, 'resolveCurrentSpan').mockReturnValue(mockSpan as any);

      const dual = new DualLogger(inner, () => vnext);
      const error = {
        message: 'Something failed',
        id: 'ERR_1',
        domain: 'AGENT',
        category: 'USER',
        details: {},
        cause: { message: 'root cause' },
      } as any;
      dual.trackException(error);

      expect(inner.trackException).toHaveBeenCalledWith(error, undefined);
      expect(correlatedVnext.error).toHaveBeenCalledWith(
        'Something failed',
        expect.objectContaining({
          errorId: 'ERR_1',
          domain: 'AGENT',
        }),
      );
      expect(vnext.error).not.toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });
});
