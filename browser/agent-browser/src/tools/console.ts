import type { ConsoleStartOutput, ConsoleGetOutput, ConsoleClearOutput } from '@mastra/core/browser';
import {
  consoleStartInputSchema,
  consoleStartOutputSchema,
  consoleGetInputSchema,
  consoleGetOutputSchema,
  consoleClearInputSchema,
  consoleClearOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createConsoleStartTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_console_start',
    description: 'Start tracking console messages (log, warn, error, etc.).',
    inputSchema: consoleStartInputSchema,
    outputSchema: consoleStartOutputSchema,
    execute: async (): Promise<ConsoleStartOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.startConsoleTracking) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Console tracking not supported by this browser provider.',
          };
        }

        browser.startConsoleTracking();

        return {
          success: true,
          message: 'Console tracking started.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}

export function createConsoleGetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_console_get',
    description: 'Get tracked console messages.',
    inputSchema: consoleGetInputSchema,
    outputSchema: consoleGetOutputSchema,
    execute: async (): Promise<ConsoleGetOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.getConsoleMessages) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Console tracking not supported by this browser provider.',
          };
        }

        const messages = browser.getConsoleMessages();

        return {
          success: true,
          messages: messages.map(msg => ({
            type: msg.type,
            text: msg.text,
            timestamp: msg.timestamp,
          })),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}

export function createConsoleClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_console_clear',
    description: 'Clear tracked console messages.',
    inputSchema: consoleClearInputSchema,
    outputSchema: consoleClearOutputSchema,
    execute: async (): Promise<ConsoleClearOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.clearConsoleMessages) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Console tracking not supported by this browser provider.',
          };
        }

        browser.clearConsoleMessages();

        return {
          success: true,
          message: 'Console messages cleared.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: ErrorCode.UNKNOWN,
          message,
        };
      }
    },
  });
}
