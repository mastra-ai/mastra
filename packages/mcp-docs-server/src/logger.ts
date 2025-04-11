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
        data: data ? { message, ...data } : message,
      });
    } catch (error) {
      // Only log connection errors during startup
      if (
        error instanceof Error &&
        (error.message === 'Not connected' || error.message.includes('does not support logging'))
      ) {
        return;
      }
      // Log other errors that happen after connection
      console.error(`Failed to send ${level} log:`, error);
    }
  };

  return {
    info: async (message: string, data?: any) => {
      console.error(`[INFO] ${message}`);
      await sendLog('info', message, data);
    },
    warning: async (message: string, data?: any) => {
      console.error(`[WARN] ${message}`);
      await sendLog('warning', message, data);
    },
    error: async (message: string, error?: any) => {
      console.error(`[ERROR] ${message}`);
      if (error?.stack) console.error(error.stack);
      await sendLog('error', message, error?.stack ? { stack: error.stack } : error);
    },
    debug: async (message: string, data?: any) => {
      if (process.env.DEBUG) {
        console.error(`[DEBUG] ${message}`);
        await sendLog('debug', message, data);
      }
    },
  };
}

// Create a default logger instance for use before server initialization
export const logger = createLogger();
