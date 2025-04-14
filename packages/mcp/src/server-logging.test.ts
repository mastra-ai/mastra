import { spawn } from 'child_process';
import path from 'path';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import type { LogMessage, LoggingLevel } from './client';
import { MCPConfiguration } from './configuration';

// Increase test timeout for server operations
vi.setConfig({ testTimeout: 80000, hookTimeout: 80000 });

describe('MCP Server Logging', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let weatherProcess: ReturnType<typeof spawn>;

  beforeAll(async () => {
    // Start the weather SSE server
    weatherProcess = spawn('npx', ['-y', 'tsx', path.join(__dirname, '__fixtures__/weather.ts')], {
      env: { ...process.env, PORT: '60809' },
    });

    // Wait for SSE server to be ready
    let resolved = false;
    await new Promise<void>((resolve, reject) => {
      weatherProcess.on(`exit`, () => {
        if (!resolved) reject();
      });
      if (weatherProcess.stderr) {
        weatherProcess.stderr.on(`data`, chunk => {
          console.error(chunk.toString());
        });
      }
      if (weatherProcess.stdout) {
        weatherProcess.stdout.on('data', chunk => {
          if (chunk.toString().includes('server is running on SSE')) {
            resolve();
            resolved = true;
          }
        });
      }
    });
  });

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Kill the weather SSE server
    weatherProcess.kill('SIGINT');
  });

  it('should log events from specific servers to their handlers', async () => {
    // Create individual log handlers for each server
    const weatherLogHandler = vi.fn();
    const stockLogHandler = vi.fn();

    const config = new MCPConfiguration({
      id: 'server-log-test',
      servers: {
        weather: {
          url: new URL('http://localhost:60809/sse'),
          log: weatherLogHandler,
        },
        stock: {
          command: 'npx',
          args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/stock-price.ts')],
          env: {
            FAKE_CREDS: 'test',
          },
          log: stockLogHandler,
        },
      },
    });

    await config.getTools();

    // Verify weather logs went to weather handler only
    expect(weatherLogHandler).toHaveBeenCalled();

    // Check logs contain server name
    const weatherLogs = weatherLogHandler.mock.calls.map(call => call[0]);
    weatherLogs.forEach(log => {
      expect(log).toMatchObject({
        serverName: 'weather',
        timestamp: expect.any(Date),
      });
    });

    // Verify stock logs went to stock handler only
    expect(stockLogHandler).toHaveBeenCalled();

    // Check logs contain server name
    const stockLogs = stockLogHandler.mock.calls.map(call => call[0]);
    stockLogs.forEach(log => {
      expect(log).toMatchObject({
        serverName: 'stock',
        timestamp: expect.any(Date),
      });
    });

    // Clean up
    await config.disconnect();
  });

  it('should work with handlers that filter events by log level', async () => {
    // Create a handler that only logs errors and critical/emergency messages
    const errorCounter = { count: 0 };
    const highSeverityHandler = vi.fn((logMessage: LogMessage) => {
      if (['error', 'critical', 'alert', 'emergency'].includes(logMessage.level)) {
        errorCounter.count++;
      }
    });

    // Intentionally use a non-existent command to generate errors
    const config = new MCPConfiguration({
      id: 'error-log-test',
      servers: {
        badServer: {
          command: 'nonexistent-command-that-will-fail',
          args: [],
          log: highSeverityHandler,
        },
      },
    });

    // This should fail, but our logger should capture the error
    try {
      await config.getTools();
    } catch {
      // Expected to fail
    }

    // Verify error logger was called
    expect(highSeverityHandler).toHaveBeenCalled();

    // Check we logged at least one error
    expect(errorCounter.count).toBeGreaterThan(0);

    // Clean up
    await config.disconnect();
  });

  it('should support console logging patterns', async () => {
    const _logLevels: LoggingLevel[] = [
      'debug',
      'info',
      'notice',
      'warning',
      'error',
      'critical',
      'alert',
      'emergency',
    ];
    const logMessages: string[] = [];

    const consoleLogger = (logMessage: LogMessage) => {
      const formatted = `${logMessage.level}: ${logMessage.message}`;
      logMessages.push(formatted);
      console.log(formatted);
    };

    const config = new MCPConfiguration({
      id: 'console-log-test',
      servers: {
        echoServer: {
          command: 'echo',
          args: ['test'],
          log: consoleLogger,
        },
      },
    });

    try {
      await config.getTools();
    } catch {
      // May fail, but we just care about logging
    }

    // Verify console.log was called
    expect(consoleLogSpy).toHaveBeenCalled();

    // Clean up
    await config.disconnect();
  });
});
