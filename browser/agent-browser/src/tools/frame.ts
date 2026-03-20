import type { FrameSwitchOutput, FrameMainOutput } from '@mastra/core/browser';
import {
  frameSwitchInputSchema,
  frameSwitchOutputSchema,
  frameMainInputSchema,
  frameMainOutputSchema,
  ErrorCode,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createFrameSwitchTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_frame_switch',
    description:
      'Switch to an iframe by selector, name, or URL. Use when you need to interact with content inside an iframe.',
    inputSchema: frameSwitchInputSchema,
    outputSchema: frameSwitchOutputSchema,
    execute: async ({ context }): Promise<FrameSwitchOutput> => {
      const { selector, name, url } = context;

      try {
        const browser = await getBrowser();

        if (browser.switchToFrame) {
          await browser.switchToFrame({ selector, name, url });
        } else {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Frame switching not supported by this browser provider.',
          };
        }

        const page = browser.getPage();
        const frame = browser.getFrame?.();

        return {
          success: true,
          url: page.url(),
          frameUrl: frame?.url?.(),
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

export function createFrameMainTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_frame_main',
    description: 'Switch back to the main frame from an iframe.',
    inputSchema: frameMainInputSchema,
    outputSchema: frameMainOutputSchema,
    execute: async (): Promise<FrameMainOutput> => {
      try {
        const browser = await getBrowser();

        if (browser.switchToMainFrame) {
          browser.switchToMainFrame();
        } else {
          return {
            success: false,
            code: ErrorCode.UNKNOWN,
            message: 'Frame switching not supported by this browser provider.',
          };
        }

        const page = browser.getPage();

        return {
          success: true,
          url: page.url(),
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
