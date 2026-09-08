import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LogLevel, RegisteredLogger } from './constants';
import { ConsoleLogger } from './default-logger';

describe('ConsoleLogger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('child()', () => {
    it('creates a child logger with the specified component', () => {
      const parent = new ConsoleLogger({ name: 'test', level: LogLevel.DEBUG });
      const child = parent.child(RegisteredLogger.AGENT);

      expect(child).toBeInstanceOf(ConsoleLogger);
      expect(child).not.toBe(parent);
    });

    it('inherits name and level from parent', () => {
      const parent = new ConsoleLogger({ name: 'test', level: LogLevel.WARN });
      const child = parent.child(RegisteredLogger.AGENT);

      // Verify by checking the child only logs at WARN level (inherited from parent)
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      child.info('should not log');
      child.warn('should log');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('[AGENT] should log');
      infoSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('inherits filter from parent', () => {
      const filter = vi.fn().mockReturnValue(true);
      const parent = new ConsoleLogger({ level: LogLevel.DEBUG, filter });
      const child = parent.child(RegisteredLogger.AGENT);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      child.debug('test message');

      expect(filter).toHaveBeenCalledWith({
        component: RegisteredLogger.AGENT,
        level: LogLevel.DEBUG,
        message: 'test message',
        args: [],
      });
      infoSpy.mockRestore();
    });

    it('prefixes messages with [COMPONENT]', () => {
      const parent = new ConsoleLogger({ level: LogLevel.DEBUG });
      const child = parent.child(RegisteredLogger.WORKFLOW);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      child.debug('test message');

      expect(infoSpy).toHaveBeenCalledWith('[WORKFLOW] test message');
      infoSpy.mockRestore();
    });

    it('parent logger has no prefix', () => {
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.debug('test message');

      expect(infoSpy).toHaveBeenCalledWith('test message');
      infoSpy.mockRestore();
    });
  });

  describe('filter', () => {
    it('logs when filter returns true', () => {
      const logger = new ConsoleLogger({
        level: LogLevel.DEBUG,
        filter: () => true,
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.debug('test message');

      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it('does not log when filter returns false', () => {
      const logger = new ConsoleLogger({
        level: LogLevel.DEBUG,
        filter: () => false,
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.debug('test message');

      expect(infoSpy).not.toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it('receives component in filter context', () => {
      const filter = vi.fn().mockReturnValue(true);
      const parent = new ConsoleLogger({ level: LogLevel.DEBUG, filter });
      const child = parent.child(RegisteredLogger.AGENT);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      child.info('hello');

      expect(filter).toHaveBeenCalledWith(expect.objectContaining({ component: RegisteredLogger.AGENT }));
      infoSpy.mockRestore();
    });

    it('receives level in filter context', () => {
      const filter = vi.fn().mockReturnValue(true);
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG, filter });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(filter).toHaveBeenCalledWith(expect.objectContaining({ level: LogLevel.DEBUG }));
      expect(filter).toHaveBeenCalledWith(expect.objectContaining({ level: LogLevel.INFO }));
      expect(filter).toHaveBeenCalledWith(expect.objectContaining({ level: LogLevel.WARN }));
      expect(filter).toHaveBeenCalledWith(expect.objectContaining({ level: LogLevel.ERROR }));

      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('receives message and args in filter context', () => {
      const filter = vi.fn().mockReturnValue(true);
      const logger = new ConsoleLogger({ level: LogLevel.DEBUG, filter });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.debug('hello %s', 'world', { extra: true });

      expect(filter).toHaveBeenCalledWith({
        component: undefined,
        level: LogLevel.DEBUG,
        message: 'hello %s',
        args: ['world', { extra: true }],
      });
      infoSpy.mockRestore();
    });

    it('can filter by component', () => {
      const logger = new ConsoleLogger({
        level: LogLevel.DEBUG,
        filter: ({ component }) => component === RegisteredLogger.AGENT,
      });

      const agentChild = logger.child(RegisteredLogger.AGENT);
      const workflowChild = logger.child(RegisteredLogger.WORKFLOW);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      agentChild.debug('from agent');
      workflowChild.debug('from workflow');

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(infoSpy).toHaveBeenCalledWith('[AGENT] from agent');
      infoSpy.mockRestore();
    });

    it('can filter by message content', () => {
      const logger = new ConsoleLogger({
        level: LogLevel.DEBUG,
        filter: ({ message }) => !message.includes('noisy'),
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

      logger.debug('important message');
      logger.debug('noisy debug output');
      logger.debug('another important one');

      expect(infoSpy).toHaveBeenCalledTimes(2);
      expect(infoSpy).toHaveBeenCalledWith('important message');
      expect(infoSpy).toHaveBeenCalledWith('another important one');
      infoSpy.mockRestore();
    });
  });

  describe('log levels', () => {
    it('respects log level threshold', () => {
      const logger = new ConsoleLogger({ level: LogLevel.WARN });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith('warn');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith('error');

      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('filter error handling', () => {
    it('logs message when filter throws, to avoid breaking logging', () => {
      const throwingFilter = () => {
        throw new Error('filter crashed');
      };

      const logger = new ConsoleLogger({
        level: LogLevel.INFO,
        filter: throwingFilter,
      });

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.info('test message');

      // Message should still be logged (filter error = allow through)
      expect(infoSpy).toHaveBeenCalledWith('test message');
      // Error should be reported
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[Logger] Filter error'), expect.any(Error));

      infoSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('observability adapter (__attachObservability)', () => {
    const TRACE_FIELDS = { trace_id: '0af7651916cd43dd8448eb211c80319c', span_id: 'b7ad6b7169203331' };

    function makeSink() {
      return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    }

    function makeCtx(overrides: Partial<Parameters<ConsoleLogger['__attachObservability']>[0]> = {}) {
      const sink = makeSink();
      return {
        sink,
        ctx: {
          resolveTraceFields: () => TRACE_FIELDS,
          getLogSink: () => sink,
          options: { correlation: true, export: true },
          ...overrides,
        },
      };
    }

    it('appends trace fields to the native console record when a span is active', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx } = makeCtx();
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello', { a: 1 });

      expect(infoSpy).toHaveBeenCalledWith('hello', { a: 1 }, TRACE_FIELDS);
      infoSpy.mockRestore();
    });

    it('omits trace fields when no span is active', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx } = makeCtx({ resolveTraceFields: () => undefined });
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello');

      expect(infoSpy).toHaveBeenCalledWith('hello');
      infoSpy.mockRestore();
    });

    it('does not append trace fields when correlation is disabled', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx } = makeCtx({ options: { correlation: false, export: true } });
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello');

      expect(infoSpy).toHaveBeenCalledWith('hello');
      infoSpy.mockRestore();
    });

    it('exports a record derived from the same native call', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx();
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      const err = new Error('boom');
      logger.info('hello', { a: 1 }, err);

      expect(sink.info).toHaveBeenCalledWith('hello', {
        a: 1,
        error: { name: 'Error', message: 'boom', stack: err.stack },
      });
      infoSpy.mockRestore();
    });

    it('exports even when the console level filter suppresses native output', () => {
      const logger = new ConsoleLogger({ level: LogLevel.ERROR });
      const { ctx, sink } = makeCtx();
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('suppressed natively');

      expect(infoSpy).not.toHaveBeenCalled();
      expect(sink.info).toHaveBeenCalledWith('suppressed natively', undefined);
      infoSpy.mockRestore();
    });

    it('does not export when export option is disabled', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx({ options: { correlation: true, export: false } });
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      logger.info('hello');

      expect(sink.info).not.toHaveBeenCalled();
      // Correlation stays on
      expect(infoSpy).toHaveBeenCalledWith('hello', TRACE_FIELDS);
      infoSpy.mockRestore();
    });

    it('never lets a throwing sink break the native log call', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx();
      sink.info.mockImplementation(() => {
        throw new Error('sink boom');
      });
      logger.__attachObservability(ctx);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      expect(() => logger.info('hello')).not.toThrow();
      expect(infoSpy).toHaveBeenCalled();
      infoSpy.mockRestore();
    });

    it('routes trackException through the sink with MastraError fields', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx();
      logger.__attachObservability(ctx);

      const err = Object.assign(new Error('tracked boom'), { id: 'ERR_1', domain: 'AGENT', category: 'USER' });
      logger.trackException(err, { runId: 'r1' });

      expect(sink.error).toHaveBeenCalledWith('tracked boom', {
        errorId: 'ERR_1',
        domain: 'AGENT',
        category: 'USER',
        runId: 'r1',
      });
    });

    it('forwards details and serializes the Error cause on tracked exceptions', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx();
      logger.__attachObservability(ctx);

      const err = Object.assign(new Error('tracked boom', { cause: new Error('root cause') }), {
        id: 'ERR_1',
        domain: 'AGENT',
        category: 'USER',
        details: { step: 'generate' },
      });
      logger.trackException(err);

      expect(sink.error).toHaveBeenCalledWith('tracked boom', {
        errorId: 'ERR_1',
        domain: 'AGENT',
        category: 'USER',
        details: { step: 'generate' },
        cause: 'root cause',
      });
    });

    it('does not export tracked exceptions when export is disabled', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx({ options: { correlation: true, export: false } });
      logger.__attachObservability(ctx);

      logger.trackException(new Error('silent'));

      expect(sink.error).not.toHaveBeenCalled();
    });

    it('propagates the adapter context to child loggers', () => {
      const logger = new ConsoleLogger({ level: LogLevel.INFO });
      const { ctx, sink } = makeCtx();
      logger.__attachObservability(ctx);
      const child = logger.child(RegisteredLogger.AGENT);

      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      child.info('from child');

      expect(infoSpy).toHaveBeenCalledWith('[AGENT] from child', TRACE_FIELDS);
      expect(sink.info).toHaveBeenCalledWith('from child', undefined);
      infoSpy.mockRestore();
    });
  });
});
