import type { RecordStartOutput, RecordStopOutput } from '@mastra/core/browser';
import {
  recordStartInputSchema,
  recordStartOutputSchema,
  recordStopInputSchema,
  recordStopOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createRecordStartTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_record_start',
    description: 'Start recording a video of the browser session.',
    inputSchema: recordStartInputSchema,
    outputSchema: recordStartOutputSchema,
    execute: async ({ context }): Promise<RecordStartOutput> => {
      const { path, url } = context;

      try {
        const browser = await getBrowser();

        if (!browser.startRecording) {
          return {
            success: false,
            code: 'unknown',
            message: 'Recording not supported by this browser provider.',
          };
        }

        await browser.startRecording(path, url);

        return {
          success: true,
          path,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}

export function createRecordStopTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_record_stop',
    description: 'Stop recording and save the video file.',
    inputSchema: recordStopInputSchema,
    outputSchema: recordStopOutputSchema,
    execute: async (): Promise<RecordStopOutput> => {
      try {
        const browser = await getBrowser();

        if (!browser.stopRecording) {
          return {
            success: false,
            code: 'unknown',
            message: 'Recording not supported by this browser provider.',
          };
        }

        const result = await browser.stopRecording();

        return {
          success: true,
          path: result?.path ?? 'recording.webm',
          frames: result?.frames,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'unknown',
          message,
        };
      }
    },
  });
}
