import type {
  ClipboardCopyOutput,
  ClipboardPasteOutput,
  ClipboardReadOutput,
  ClipboardWriteOutput,
} from '@mastra/core/browser';
import {
  clipboardCopyInputSchema,
  clipboardCopyOutputSchema,
  clipboardPasteInputSchema,
  clipboardPasteOutputSchema,
  clipboardReadInputSchema,
  clipboardReadOutputSchema,
  clipboardWriteInputSchema,
  clipboardWriteOutputSchema,
} from '@mastra/core/browser';
import { createTool } from '@mastra/core/tools';

import type { BrowserManagerLike } from '../browser-types';

export function createClipboardCopyTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clipboard_copy',
    description: 'Copy currently selected content to clipboard (simulates Ctrl+C/Cmd+C).',
    inputSchema: clipboardCopyInputSchema,
    outputSchema: clipboardCopyOutputSchema,
    execute: async (): Promise<ClipboardCopyOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.press('Control+c');

        return {
          success: true,
          message: 'Copied selection to clipboard',
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

export function createClipboardPasteTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clipboard_paste',
    description: 'Paste clipboard content at current cursor position (simulates Ctrl+V/Cmd+V).',
    inputSchema: clipboardPasteInputSchema,
    outputSchema: clipboardPasteOutputSchema,
    execute: async (): Promise<ClipboardPasteOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.keyboard.press('Control+v');

        return {
          success: true,
          message: 'Pasted from clipboard',
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

export function createClipboardReadTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clipboard_read',
    description: 'Read text content from the clipboard.',
    inputSchema: clipboardReadInputSchema,
    outputSchema: clipboardReadOutputSchema,
    execute: async (): Promise<ClipboardReadOutput> => {
      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        const text = await page.evaluate(() => navigator.clipboard.readText());

        return {
          success: true,
          text: text as string,
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

export function createClipboardWriteTool(getBrowser: () => Promise<BrowserManagerLike>) {
  return createTool({
    id: 'browser_clipboard_write',
    description: 'Write text to the clipboard.',
    inputSchema: clipboardWriteInputSchema,
    outputSchema: clipboardWriteOutputSchema,
    execute: async ({ context }): Promise<ClipboardWriteOutput> => {
      const { text } = context;

      try {
        const browser = await getBrowser();
        const page = browser.getPage();

        await page.evaluate((t: string) => navigator.clipboard.writeText(t), text);

        return {
          success: true,
          message: 'Text written to clipboard',
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
