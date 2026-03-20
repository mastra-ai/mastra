/**
 * Browser Keyboard Tool
 *
 * Handles global keyboard operations (not tied to an element):
 * - type: Type text
 * - insert_text: Insert text without key events
 * - key_down: Press and hold a key
 * - key_up: Release a key
 */

import { createTool } from '../../tools';
import { createError } from '../errors';
import { keyboardInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserKeyboardTool = createTool({
  id: 'browser_keyboard',
  description: `Global keyboard operations. Actions:
- type: Type text with key events
- insert_text: Insert text directly (no key events)
- key_down: Press and hold a key
- key_up: Release a key`,
  inputSchema: keyboardInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.keyboard(input as Parameters<typeof browser.keyboard>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return createError('browser_error', `Keyboard operation failed: ${msg}`);
    }
  },
});
