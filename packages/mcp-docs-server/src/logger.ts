import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { MCPServer } from '@mastra/mcp';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

// Simplified log levels matching MCP client (debug, info, warn, error, none)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

// Priority map for log level filtering (higher = more severe)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4, // none = disable all logs
};

// Map MCP LoggingLevel to our simplified LogLevel
function mapToLogLevel(level: LoggingLevel): LogLevel {
  switch (level) {
    case 'debug':
      return 'debug';
    case 'info':
    case 'notice':
      return 'info';
    case 'warning':
      return 'warn';
    case 'error':
    case 'critical':
    case 'alert':
    case 'emergency':
      return 'error';
    default:
      return 'info';
  }
}

// Current log level (default: debug = show all)
let currentLogLevel: LogLevel = 'debug';

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

// Check if a log level should be shown based on current minimum level
function shouldLog(level: LoggingLevel): boolean {
  const mappedLevel = mapToLogLevel(level);
  return LOG_LEVEL_PRIORITY[mappedLevel] >= LOG_LEVEL_PRIORITY[currentLogLevel];
}

// Logger interface for type safety
export interface Logger {
  debug: (message: string, data?: any) => Promise<void>;
  info: (message: string, data?: any) => Promise<void>;
  notice: (message: string, data?: any) => Promise<void>;
  warning: (message: string, data?: any) => Promise<void>;
  error: (message: string, error?: any) => Promise<void>;
  critical: (message: string, error?: any) => Promise<void>;
  alert: (message: string, error?: any) => Promise<void>;
  emergency: (message: string, error?: any) => Promise<void>;
}

export const writeErrorLog = (message: string, data?: any) => {
  const now = new Date();
  const timestamp = now.toISOString();
  const hourTimestamp = timestamp.slice(0, 13); // YYYY-MM-DDTHH

  // Create log message
  const logMessage = {
    timestamp,
    message,
    ...(data ? (typeof data === 'object' ? data : { data }) : {}),
  };

  // Write to file
  try {
    // Ensure cache directory exists
    const cacheDir = path.join(os.homedir(), '.cache', 'mastra', 'mcp-docs-server-logs');
    fs.mkdirSync(cacheDir, { recursive: true });

    // Create log file path with timestamp
    const logFile = path.join(cacheDir, `${hourTimestamp}.log`);

    // Append log entry to file
    fs.appendFileSync(logFile, JSON.stringify(logMessage) + '\n', 'utf8');
  } catch (err) {
    // If file writing fails, at least we still have stdout
    console.error('Failed to write to log file:', err);
  }
};

// Create logger factory to inject server instance
export function createLogger(server?: MCPServer): Logger {
  const sendLog = async (level: LoggingLevel, message: string, data?: any) => {
    if (!server) return;
    if (!shouldLog(level)) return;

    try {
      const sdkServer = server.getServer();
      if (!sdkServer) return;
      await sdkServer.sendLoggingMessage({
        level,
        data: {
          message,
          ...(data ? (typeof data === 'object' ? data : { data }) : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'Not connected' ||
          error.message.includes('does not support logging') ||
          error.message.includes('Connection closed'))
      ) {
        return;
      }
      console.error(`Failed to send ${level} log:`, error instanceof Error ? error.message : error);
    }
  };

  return {
    debug: async (message: string, data?: any) => {
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        await sendLog('debug', message, data);
      }
    },
    info: async (message: string, data?: any) => {
      await sendLog('info', message, data);
    },
    notice: async (message: string, data?: any) => {
      await sendLog('notice', message, data);
    },
    warning: async (message: string, data?: any) => {
      await sendLog('warning', message, data);
    },
    error: async (message: string, error?: any) => {
      const errorData =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error;
      writeErrorLog(message, errorData);
      await sendLog('error', message, errorData);
    },
    critical: async (message: string, error?: any) => {
      const errorData =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error;
      writeErrorLog(message, errorData);
      await sendLog('critical', message, errorData);
    },
    alert: async (message: string, error?: any) => {
      const errorData =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error;
      writeErrorLog(message, errorData);
      await sendLog('alert', message, errorData);
    },
    emergency: async (message: string, error?: any) => {
      const errorData =
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error;
      writeErrorLog(message, errorData);
      await sendLog('emergency', message, errorData);
    },
  };
}

// Create a default logger instance
export const logger = createLogger();
