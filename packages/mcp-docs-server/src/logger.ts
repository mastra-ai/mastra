import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { LoggingLevel } from '@modelcontextprotocol/sdk/types.js';

// Logger interface for type safety
export interface Logger {
  info: (message: string, data?: any) => Promise<void>;
  warning: (message: string, data?: any) => Promise<void>;
  error: (message: string, error?: any) => Promise<void>;
  debug: (message: string, data?: any) => Promise<void>;
}

export function convertLogLevelToLoggerMethod(level: LoggingLevel): 'debug' | 'info' | 'warn' | 'error' {
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
      // For any other levels, default to info
      return 'info';
  }
}

// Create logger factory to inject server instance
export function createLogger(server?: Server): Logger {
  const writeLog = (level: string, message: string, data?: any) => {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    process.stderr.write(`${timestamp} [${level}] docs: ${message}${logData}\n`);
  };

  const sendLog = async (level: 'error' | 'debug' | 'info' | 'warning', message: string, data?: any) => {
    if (!server) return;

    try {
      await server.sendLoggingMessage({
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
    info: async (message: string, data?: any) => {
      console.error(`[INFO]: ${message}`, data || '');
      writeLog('info', message, data);
      await sendLog('info', message, data);
    },
    warning: async (message: string, data?: any) => {
      console.error(`[WARNING]: ${message}`, data || '');
      writeLog('warning', message, data);
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
      console.error(`[ERROR]: ${message}`, errorData || '');
      writeLog('error', message, errorData);
      await sendLog('error', message, errorData);
    },
    debug: async (message: string, data?: any) => {
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        console.error(`[DEBUG]: ${message}`, data || '');
        writeLog('debug', message, data);
        await sendLog('debug', message, data);
      }
    },
  };
}

// Create a default logger instance
export const logger = createLogger();
