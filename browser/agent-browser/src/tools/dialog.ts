import type { DialogHandleOutput, DialogClearOutput } from '@mastra/core/browser';
import {
  dialogHandleInputSchema,
  dialogHandleOutputSchema,
  dialogClearInputSchema,
  dialogClearOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createDialogHandleTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_dialog_handle',
    description: 'Set how to handle JavaScript dialogs (alert, confirm, prompt). Call this before triggering a dialog.',
    inputSchema: dialogHandleInputSchema,
    outputSchema: dialogHandleOutputSchema,
    execute: async ({ context }): Promise<DialogHandleOutput> => {
      const { action, promptText } = context;

      try {
        const browser = await getBrowser();

        if (browser.setDialogHandler) {
          browser.setDialogHandler(action, promptText);
        } else {
          return {
            success: false,
            code: 'unknown',
            message: 'Dialog handling not supported by this browser provider.',
          };
        }

        return {
          success: true,
          message: `Dialog handler set to ${action}${promptText ? ` with text "${promptText}"` : ''}.`,
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

export function createDialogClearTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_dialog_clear',
    description: 'Clear the dialog handler, reverting to default browser behavior.',
    inputSchema: dialogClearInputSchema,
    outputSchema: dialogClearOutputSchema,
    execute: async (): Promise<DialogClearOutput> => {
      try {
        const browser = await getBrowser();

        if (browser.clearDialogHandler) {
          browser.clearDialogHandler();
        } else {
          return {
            success: false,
            code: 'unknown',
            message: 'Dialog handling not supported by this browser provider.',
          };
        }

        return {
          success: true,
          message: 'Dialog handler cleared.',
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
