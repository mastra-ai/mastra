import type { ErrorsStartOutput, ErrorsGetOutput, ErrorsClearOutput } from '@mastra/core/browser';
import {
  errorsStartInputSchema,
  errorsStartOutputSchema,
  errorsGetInputSchema,
  errorsGetOutputSchema,
  errorsClearInputSchema,
  errorsClearOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createErrorsStartTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_errors_start',
    description: 'Start tracking page errors.',
    inputSchema: errorsStartInputSchema,
    outputSchema: errorsStartOutputSchema,
    execute: async (): Promise<ErrorsStartOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.startErrorTracking) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Error tracking not supported by this browser provider.',
          };
        }

        browser.startErrorTracking();

        return {
          success: true,
          message: 'Error tracking started.',
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

export function createErrorsGetTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_errors_get',
    description: 'Get tracked page errors.',
    inputSchema: errorsGetInputSchema,
    outputSchema: errorsGetOutputSchema,
    execute: async (): Promise<ErrorsGetOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.getPageErrors) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Error tracking not supported by this browser provider.',
          };
        }

        const errors = browser.getPageErrors();

        return {
          success: true,
          errors: errors.map(err => ({
            message: err.message,
            timestamp: err.timestamp,
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

export function createErrorsClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_errors_clear',
    description: 'Clear tracked page errors.',
    inputSchema: errorsClearInputSchema,
    outputSchema: errorsClearOutputSchema,
    execute: async (): Promise<ErrorsClearOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.clearPageErrors) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Error tracking not supported by this browser provider.',
          };
        }

        browser.clearPageErrors();

        return {
          success: true,
          message: 'Page errors cleared.',
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
