/**
 * Browser Input Tool
 *
 * Handles text input operations:
 * - fill: Fill an input field
 * - type: Type text character by character
 * - clear: Clear input field
 * - select_all: Select all text in input
 * - get_value: Get current input value
 */

import { createTool } from '../../tools';
import { inputInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserInputTool = createTool({
  id: 'browser_input',
  description: `Handle text input operations. Actions:
- fill: Fill an input field (fast, replaces content)
- type: Type text character by character (triggers key events)
- clear: Clear an input field
- select_all: Select all text in input
- get_value: Get current value of input field`,
  inputSchema: inputInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.input(input as Parameters<typeof browser.input>[0]);
  },
});
