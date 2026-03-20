import type { KeyboardTypeOutput, KeyboardInsertTextOutput, KeyDownOutput, KeyUpOutput } from '@mastra/core/browser';
import {
  keyboardTypeInputSchema,
  keyboardTypeOutputSchema,
  keyboardInsertTextInputSchema,
  keyboardInsertTextOutputSchema,
  keyDownInputSchema,
  keyDownOutputSchema,
  keyUpInputSchema,
  keyUpOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';
import type { BrowserManagerLike } from '../browser-types';

export function createKeyboardTypeTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_keyboard_type',
    description: 'Type text at the current focus position without targeting a specific element',
    inputSchema: keyboardTypeInputSchema,
    outputSchema: keyboardTypeOutputSchema,
    execute: async ({ context: { text } }): Promise<KeyboardTypeOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.type(text);

        return {
          success: true,
          url: page.url(),
          hint: 'Text typed at current focus. Use browser_snapshot to verify or continue.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'keyboard_type_failed',
          message: `Failed to type text: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}

export function createKeyboardInsertTextTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_keyboard_insert_text',
    description: 'Insert text at current focus without triggering key events (faster, bypasses input handlers)',
    inputSchema: keyboardInsertTextInputSchema,
    outputSchema: keyboardInsertTextOutputSchema,
    execute: async ({ context: { text } }): Promise<KeyboardInsertTextOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.insertText(text);

        return {
          success: true,
          url: page.url(),
          hint: 'Text inserted at current focus. Use browser_snapshot to verify.',
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'keyboard_insert_failed',
          message: `Failed to insert text: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}

export function createKeyDownTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_key_down',
    description: 'Hold a key down (e.g., Shift, Control, Alt). Use browser_key_up to release.',
    inputSchema: keyDownInputSchema,
    outputSchema: keyDownOutputSchema,
    execute: async ({ context: { key } }): Promise<KeyDownOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.down(key);

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'key_down_failed',
          message: `Failed to press key down: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}

export function createKeyUpTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_key_up',
    description: 'Release a key that was held down with browser_key_down',
    inputSchema: keyUpInputSchema,
    outputSchema: keyUpOutputSchema,
    execute: async ({ context: { key } }): Promise<KeyUpOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.up(key);

        return {
          success: true,
          url: page.url(),
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          success: false,
          code: 'key_up_failed',
          message: `Failed to release key: ${message}`,
          canRetry: true,
        };
      }
    },
  });
}
