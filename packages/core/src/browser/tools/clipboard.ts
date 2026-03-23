/**
 * Browser Clipboard Tool
 *
 * Clipboard operations:
 * - copy: Copy text to clipboard
 * - paste: Paste from clipboard
 * - read: Read clipboard content
 * - write: Write to clipboard
 */

import { createTool } from '../../tools';
import { clipboardInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserClipboardTool = createTool({
  id: 'browser_clipboard',
  description: `Clipboard operations. Actions:
- copy: Copy text to clipboard (or element content by ref)
- paste: Paste clipboard content
- read: Read current clipboard content
- write: Write text to clipboard`,
  inputSchema: clipboardInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.clipboard(input as Parameters<typeof browser.clipboard>[0]);
  },
});
