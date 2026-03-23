/**
 * Browser Input Tool
 *
 * Handles text input operations:
 * - fill: Fill an input field (replaces content)
 * - type: Type text character by character
 * - press: Press a key
 * - clear: Clear input field
 * - select_all: Select all text in input
 */

import { createTool } from '../../tools';
import { createError } from '../errors';
import { inputInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserInputTool = createTool({
  id: 'browser_input',
  description: `Handle text input operations. Actions:
- fill: Fill an input field (fast, replaces content)
- type: Type text character by character (triggers key events)
- press: Press a key (Enter, Tab, etc.)
- clear: Clear an input field
- select_all: Select all text in input`,
  inputSchema: inputInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.input(input as Parameters<typeof browser.input>[0]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);

      // Stale ref
      if (msg.includes('STALE_REF:')) {
        const ref = msg.split('STALE_REF:')[1];
        return createError(
          'stale_ref',
          `Ref ${ref} not found. The page has changed.`,
          'IMPORTANT: Take a new snapshot NOW to see the current page state and get fresh refs.',
        );
      }

      // Not an input element
      if (msg.includes('not an input') || msg.includes('not editable')) {
        return createError(
          'not_focusable',
          'Element is not an editable input element.',
          'Check that you are targeting the correct element. Take a new snapshot to verify.',
        );
      }

      // Timeout
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        return createError(
          'timeout',
          'Input operation timed out.',
          'Take a new snapshot - the element may have moved or the page may have changed.',
        );
      }

      // Generic error
      return createError(
        'browser_error',
        `Input operation failed: ${msg}`,
        'Take a new snapshot to see the current page state.',
      );
    }
  },
});
