import { LogLevel, LoggerTransport, MultiLogger } from '@mastra/core/logger';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { PinoLogger } from './pino';

// Helper to create a memory stream that captures log output
class MemoryStream extends LoggerTransport {
  chunks: any[] = [];

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: any, _encoding: string, callback: (error: Error | null, chunk: any) => void) {
    try {
      // Handle both string and object chunks
      const logEntry = typeof chunk === 'string' ? JSON.parse(chunk) : chunk;
      this.chunks.push(logEntry);
    } catch (error) {
      console.error('Error parsing log entry:', error);
    }
    callback(null, chunk);
  }

  async listLogs() {
    return this.chunks;
  }

  clear() {
    this.chunks = [];
  }
}

// Deterministic wait for the pino transport to flush (no fixed sleeps).
async function waitForLogs(stream: MemoryStream, count = 1) {
  await vi.waitFor(async () => {
    expect((await stream.listLogs()).length).toBeGreaterThanOrEqual(count);
  });
}

describe('Logger', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  describe('Logging Methods', () => {
    let logger: PinoLogger;

    beforeEach(() => {
      logger = new PinoLogger({
        transports: {
          memory: memoryStream,
        },
      });
    });

    it('should log info messages correctly', async () => {
      logger.info('test info message');

      // Wait for async logging
      await waitForLogs(memoryStream);

      const logs = await memoryStream.listLogs();

      expect(logs[0]).toMatchObject({
        level: 30, // pino uses numeric levels: info = 30
        msg: 'test info message',
      });
    });
  });
});

describe('MultiLogger', () => {
  let memoryStream1: MemoryStream;
  let memoryStream2: MemoryStream;
  let logger1: PinoLogger;
  let logger2: PinoLogger;

  beforeEach(() => {
    memoryStream1 = new MemoryStream();
    memoryStream2 = new MemoryStream();
    logger1 = new PinoLogger({ transports: { memory: memoryStream1 } });
    logger2 = new PinoLogger({ transports: { memory: memoryStream2 } });
  });

  it('should forward log calls to all loggers', async () => {
    const multiLogger = new MultiLogger([logger1, logger2]);
    const testMessage = 'test message';

    multiLogger.info(testMessage);

    await waitForLogs(memoryStream1);
    await waitForLogs(memoryStream2);

    const logs1 = await memoryStream1.listLogs();
    const logs2 = await memoryStream2.listLogs();

    expect(logs1[0]).toMatchObject({ msg: testMessage });
    expect(logs2[0]).toMatchObject({ msg: testMessage });
  });
});

describe('createLogger', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should create a logger instance', () => {
    const logger = new PinoLogger({
      transports: {
        memory: memoryStream,
      },
    });
    expect(logger).toBeInstanceOf(PinoLogger);
  });

  it('should create a logger with custom options and capture output', async () => {
    const customStream = new MemoryStream();

    const logger = new PinoLogger({
      name: 'custom',
      level: LogLevel.DEBUG,
      transports: {
        custom: customStream,
      },
    });

    logger.debug('test message');

    await waitForLogs(customStream);

    const logs = await customStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 20, // pino uses numeric levels: debug = 20
      msg: 'test message',
      name: 'custom',
    });
  });
});

describe('PinoLogger mixin option', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should merge mixin fields into every log entry', async () => {
    const logger = new PinoLogger({
      name: 'TracedApp',
      level: LogLevel.INFO,
      transports: { memory: memoryStream },
      mixin() {
        return { traceId: 'trace-1', service: 'api' };
      },
    });

    logger.info('hello', { userId: 'u1' });

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'hello',
      traceId: 'trace-1',
      service: 'api',
      userId: 'u1',
    });
  });

  it('should apply mixin on child loggers', async () => {
    const logger = new PinoLogger({
      name: 'TracedApp',
      level: LogLevel.INFO,
      transports: { memory: memoryStream },
      mixin() {
        return { traceId: 'parent-trace' };
      },
    });

    const child = logger.child({ requestId: 'req-9' });
    child.info('handled');

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'handled',
      traceId: 'parent-trace',
      requestId: 'req-9',
    });
  });
});

describe('PinoLogger observability adapter (__attachObservability)', () => {
  const TRACE_FIELDS = { trace_id: '0af7651916cd43dd8448eb211c80319c', span_id: 'b7ad6b7169203331' };
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  function makeSink() {
    const calls: Array<{ level: string; message: string; data?: Record<string, unknown> }> = [];
    const make = (level: string) => (message: string, data?: Record<string, unknown>) =>
      calls.push({ level, message, data });
    return { calls, debug: make('debug'), info: make('info'), warn: make('warn'), error: make('error') };
  }

  function makeCtx(overrides: Partial<Parameters<PinoLogger['__attachObservability']>[0]> = {}) {
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

  it('injects trace fields into the native record for all destinations', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx } = makeCtx();
    logger.__attachObservability(ctx);

    logger.info('traced', { userId: 'u1' });
    await waitForLogs(memoryStream);

    expect((await memoryStream.listLogs())[0]).toMatchObject({
      msg: 'traced',
      userId: 'u1',
      ...TRACE_FIELDS,
    });
  });

  it('omits trace fields when no span is active', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx } = makeCtx({ resolveTraceFields: () => undefined });
    logger.__attachObservability(ctx);

    logger.info('untraced');
    await waitForLogs(memoryStream);

    const record = (await memoryStream.listLogs())[0];
    expect(record.msg).toBe('untraced');
    expect(record.trace_id).toBeUndefined();
    expect(record.span_id).toBeUndefined();
  });

  it('does not inject trace fields when correlation is disabled', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx } = makeCtx({ options: { correlation: false, export: true } });
    logger.__attachObservability(ctx);

    logger.info('uncorrelated');
    await waitForLogs(memoryStream);

    expect((await memoryStream.listLogs())[0].trace_id).toBeUndefined();
  });

  it('correlates natively when observability is attached to a pre-bound child logger', async () => {
    // Common pattern: a module-level base logger, with a bound child handed
    // to Mastra. The child's pino inherits the root's mixin, so attachment
    // must flow through the shared context ref to correlate stdout.
    const base = new PinoLogger({ transports: { memory: memoryStream } });
    const child = base.child({ service: 'api' });
    const { ctx } = makeCtx();
    child.__attachObservability(ctx);

    child.info('from child');
    await waitForLogs(memoryStream);

    expect((await memoryStream.listLogs())[0]).toMatchObject({
      msg: 'from child',
      service: 'api',
      ...TRACE_FIELDS,
    });
  });

  it('preserves user mixin fields; trace fields win on conflict', async () => {
    const logger = new PinoLogger({
      transports: { memory: memoryStream },
      mixin() {
        return { service: 'api', trace_id: 'user-supplied' };
      },
    });
    const { ctx } = makeCtx();
    logger.__attachObservability(ctx);

    logger.info('mixed');
    await waitForLogs(memoryStream);

    expect((await memoryStream.listLogs())[0]).toMatchObject({
      msg: 'mixed',
      service: 'api',
      ...TRACE_FIELDS,
    });
  });

  it('exports a LogEvent derived from the same native call', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx();
    logger.__attachObservability(ctx);

    logger.warn('watch out', { code: 42 });

    // Trace identity travels on ExportedLog.traceId/spanId via the
    // span-correlated sink; data carries only the user payload.
    expect(sink.calls).toEqual([{ level: 'warn', message: 'watch out', data: { code: 42 } }]);
  });

  it('keeps user data intact on export — trace identity is not spread into the payload', () => {
    const { ctx, sink } = makeCtx();
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    logger.__attachObservability(ctx);
    logger.info('user fields preserved', { trace_id: 'user-supplied' });
    expect(sink.calls[0]?.data).toEqual({ trace_id: 'user-supplied' });
  });

  it('does not export when export is disabled but still correlates', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx({ options: { correlation: true, export: false } });
    logger.__attachObservability(ctx);

    logger.info('stdout only');
    await waitForLogs(memoryStream);

    expect(sink.calls).toEqual([]);
    expect((await memoryStream.listLogs())[0]).toMatchObject(TRACE_FIELDS);
  });

  it('never lets a throwing sink break the native log call', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const sink = {
      debug: () => {},
      info: () => {
        throw new Error('sink boom');
      },
      warn: () => {},
      error: () => {},
    };
    logger.__attachObservability({
      resolveTraceFields: () => TRACE_FIELDS,
      getLogSink: () => sink,
      options: { correlation: true, export: true },
    });

    expect(() => logger.info('resilient')).not.toThrow();
    await waitForLogs(memoryStream);
    expect((await memoryStream.listLogs())[0]).toMatchObject({ msg: 'resilient' });
  });

  it('exports an Error passed as the log payload', () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx();
    logger.__attachObservability(ctx);

    const err = new Error('boom');
    logger.error('failed', err as any);

    expect(sink.calls).toEqual([
      {
        level: 'error',
        message: 'failed',
        data: { error: { name: 'Error', message: 'boom', stack: err.stack } },
      },
    ]);
  });

  it('exports tracked exceptions through the sink', () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx();
    logger.__attachObservability(ctx);

    const err = Object.assign(new Error('tracked boom'), { id: 'ERR_1', domain: 'AGENT', category: 'USER' });
    logger.trackException(err, { runId: 'r1' });

    expect(sink.calls).toEqual([
      {
        level: 'error',
        message: 'tracked boom',
        data: { errorId: 'ERR_1', domain: 'AGENT', category: 'USER', runId: 'r1' },
      },
    ]);
  });

  it('forwards details and serializes the Error cause on tracked exceptions', () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx();
    logger.__attachObservability(ctx);

    const err = Object.assign(new Error('tracked boom', { cause: new Error('root cause') }), {
      id: 'ERR_1',
      domain: 'AGENT',
      category: 'USER',
      details: { step: 'generate' },
    });
    logger.trackException(err);

    expect(sink.calls).toEqual([
      {
        level: 'error',
        message: 'tracked boom',
        data: {
          errorId: 'ERR_1',
          domain: 'AGENT',
          category: 'USER',
          details: { step: 'generate' },
          cause: 'root cause',
        },
      },
    ]);
  });

  it('does not export tracked exceptions when export is disabled', () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx({ options: { correlation: true, export: false } });
    logger.__attachObservability(ctx);

    logger.trackException(new Error('silent'));

    expect(sink.calls).toEqual([]);
  });

  it('propagates correlation and export to child loggers', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });
    const { ctx, sink } = makeCtx();
    logger.__attachObservability(ctx);

    const child = logger.child({ requestId: 'req-1' });
    child.info('from child');
    await waitForLogs(memoryStream);

    expect((await memoryStream.listLogs())[0]).toMatchObject({
      msg: 'from child',
      requestId: 'req-1',
      ...TRACE_FIELDS,
    });
    expect(sink.calls).toEqual([{ level: 'info', message: 'from child', data: undefined }]);
  });
});

type AuditLevel = 'audit';

class PinoLoggerWithAudit extends PinoLogger<AuditLevel> {
  audit(message: string, args: Record<string, any> = {}) {
    this.logger.audit(args, message);
  }
}

describe('PinoLogger customLevels option', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should emit logs at a custom level', async () => {
    const logger = new PinoLoggerWithAudit({
      name: 'AuditApp',
      level: LogLevel.INFO,
      transports: { memory: memoryStream },
      customLevels: { audit: 35 },
    });

    logger.audit('access granted', { resource: '/admin' });

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 35,
      msg: 'access granted',
      resource: '/admin',
    });
  });
});

describe('PinoLogger redact option', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should redact sensitive data from logs using paths array', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: ['password', 'token', 'apiKey'],
    });

    logger.info('User login', {
      username: 'john',
      password: 'secret123',
      token: 'abc-xyz-123',
    });

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'User login',
      username: 'john',
      password: '[Redacted]',
      token: '[Redacted]',
    });
  });

  it('should redact sensitive data with custom censor value', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: {
        paths: ['password', 'apiKey'],
        censor: '[REDACTED]',
      },
    });

    logger.info('API call', {
      endpoint: '/api/data',
      apiKey: 'sk-12345',
    });

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      msg: 'API call',
      endpoint: '/api/data',
      apiKey: '[REDACTED]',
    });
  });

  it('should redact nested paths with wildcards', async () => {
    const logger = new PinoLogger({
      name: 'SecureApp',
      level: LogLevel.INFO,
      transports: {
        memory: memoryStream,
      },
      redact: ['*.password', 'user.email'],
    });

    logger.info('User data', {
      user: {
        name: 'John',
        email: 'john@example.com',
        password: 'secret',
      },
    });

    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0].user).toMatchObject({
      name: 'John',
      email: '[Redacted]',
      password: '[Redacted]',
    });
  });
});

describe('PinoLogger.child()', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('should create a child logger with bound context', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    // Create module-scoped logger
    const serviceLogger = baseLogger.child({ module: 'UserService' });
    serviceLogger.info('User created', { userId: '123' });

    // Wait for async logging
    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 30, // pino uses numeric levels: info = 30
      msg: 'User created',
      module: 'UserService',
      userId: '123',
    });
  });

  it('should return a PinoLogger instance', () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ module: 'TestModule' });

    expect(childLogger).toBeInstanceOf(PinoLogger);
  });

  it('should allow nested child loggers', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    // Create module-scoped logger
    const moduleLogger = baseLogger.child({ module: 'UserService' });
    // Create request-scoped logger from module logger
    const requestLogger = moduleLogger.child({ requestId: 'req-456' });

    requestLogger.info('Processing request', { action: 'create' });

    // Wait for async logging
    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs[0]).toMatchObject({
      level: 30, // pino uses numeric levels: info = 30
      msg: 'Processing request',
      module: 'UserService',
      requestId: 'req-456',
      action: 'create',
    });
  });

  it('should support all log levels in child logger', async () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      level: LogLevel.DEBUG,
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ component: 'TestComponent' });

    childLogger.debug('Debug message');
    childLogger.info('Info message');
    childLogger.warn('Warn message');
    childLogger.error('Error message');

    // Wait for async logging
    await waitForLogs(memoryStream);

    const logs = await memoryStream.listLogs();

    expect(logs).toHaveLength(4);
    // pino uses numeric levels: debug=20, info=30, warn=40, error=50
    expect(logs[0]).toMatchObject({ level: 20, component: 'TestComponent' });
    expect(logs[1]).toMatchObject({ level: 30, component: 'TestComponent' });
    expect(logs[2]).toMatchObject({ level: 40, component: 'TestComponent' });
    expect(logs[3]).toMatchObject({ level: 50, component: 'TestComponent' });
  });

  it('should inherit transports from parent logger', () => {
    const baseLogger = new PinoLogger({
      name: 'MyApp',
      transports: {
        memory: memoryStream,
      },
    });

    const childLogger = baseLogger.child({ module: 'TestModule' });

    // Child logger should have access to the same transports
    expect(childLogger.getTransports()).toEqual(baseLogger.getTransports());
  });
});

describe('PinoLogger error serialization', () => {
  let memoryStream: MemoryStream;

  beforeEach(() => {
    memoryStream = new MemoryStream();
  });

  it('serializes an Error logged under the `error` key', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });

    logger.warn('Error listing tools for agent', {
      agentName: 'test-agent',
      error: new Error('ARCADE_API_KEY is missing or empty'),
    });

    await waitForLogs(memoryStream);
    const [log] = await memoryStream.listLogs();

    expect(log.error).toMatchObject({
      type: 'Error',
      message: 'ARCADE_API_KEY is missing or empty',
    });
    expect(log.error.stack).toContain('ARCADE_API_KEY is missing or empty');
  });

  it("still serializes an Error logged under pino's `err` key", async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });

    logger.warn('failed', { err: new Error('boom') });

    await waitForLogs(memoryStream);
    const [log] = await memoryStream.listLogs();

    expect(log.err).toMatchObject({ type: 'Error', message: 'boom' });
  });

  it('leaves non-Error values under `error` untouched', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });

    logger.warn('failed', { error: { code: 'E42', detail: 'plain object' } });

    await waitForLogs(memoryStream);
    const [log] = await memoryStream.listLogs();

    expect(log.error).toEqual({ code: 'E42', detail: 'plain object' });
  });

  it('normalizes error-like plain objects under `error` while preserving their fields', async () => {
    const logger = new PinoLogger({ transports: { memory: memoryStream } });

    // Same as pino's stock behavior for `err`: anything with a string `message`
    // is treated as error-like and gets `type`/`stack`, with own fields kept.
    logger.warn('failed', { error: { message: 'invalid input', code: 'E42' } });

    await waitForLogs(memoryStream);
    const [log] = await memoryStream.listLogs();

    expect(log.error).toMatchObject({ type: 'Object', message: 'invalid input', code: 'E42' });
  });

  it('allows callers to override the default serializers', async () => {
    const logger = new PinoLogger({
      transports: { memory: memoryStream },
      serializers: { error: () => 'redacted' },
    });

    logger.warn('failed', { error: new Error('secret') });

    await waitForLogs(memoryStream);
    const [log] = await memoryStream.listLogs();

    expect(log.error).toBe('redacted');
  });
});
