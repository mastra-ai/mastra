import type { TraceStartOutput, TraceStopOutput } from '@mastra/core/browser';
import {
  traceStartInputSchema,
  traceStartOutputSchema,
  traceStopInputSchema,
  traceStopOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createTraceStartTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_trace_start',
    description: 'Start tracing browser activity for debugging. Captures screenshots and DOM snapshots.',
    inputSchema: traceStartInputSchema,
    outputSchema: traceStartOutputSchema,
    execute: async ({ context }): Promise<TraceStartOutput> => {
      const { screenshots, snapshots } = context;

      try {
        const browser = await getBrowser();

        if (!browser.startTracing) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tracing not supported by this browser provider.',
          };
        }

        await browser.startTracing({ screenshots, snapshots });

        return {
          success: true,
          message: 'Tracing started.',
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

export function createTraceStopTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_trace_stop',
    description: 'Stop tracing and save the trace file.',
    inputSchema: traceStopInputSchema,
    outputSchema: traceStopOutputSchema,
    execute: async ({ context }): Promise<TraceStopOutput> => {
      const { path } = context;

      try {
        const browser = await getBrowser();

        if (!browser.stopTracing) {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Tracing not supported by this browser provider.',
          };
        }

        await browser.stopTracing(path);

        return {
          success: true,
          path,
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
