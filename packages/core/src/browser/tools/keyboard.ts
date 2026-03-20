/**
 * Browser Keyboard Tool
 *
 * Handles global keyboard operations:
 * - press: Press a key (shortcut or key name)
 * - type: Type text globally
 * - key_down: Hold a key down
 * - key_up: Release a held key
 */

import { createTool } from '../../tools';
import { keyboardInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserKeyboardTool = createTool({
  id: 'browser_keyboard',
  description: `Global keyboard operations. Actions:
- press: Press a key or shortcut (e.g., "Enter", "Control+C")
- type: Type text globally (not in specific input)
- key_down: Hold a key down
- key_up: Release a held key`,
  inputSchema: keyboardInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.keyboard(input as Parameters<typeof browser.keyboard>[0]);
  },
});
