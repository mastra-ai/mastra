import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Logger interface for type safety
export interface Logger {
  info: (message: string, data?: any) => Promise<void>;
  warning: (message: string, data?: any) => Promise<void>;
  error: (message: string, error?: any) => Promise<void>;
  debug: (message: string, data?: any) => Promise<void>;
}

// Create logger factory to inject server instance
export function createLogger(server?: Server): Logger {
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
      await sendLog('info', message, data);
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
      await sendLog('error', message, errorData);
    },
    debug: async (message: string, data?: any) => {
      if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
        await sendLog('debug', message, data);
      }
    },
  };
}

// Create a default logger instance
export const logger = createLogger();
