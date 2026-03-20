/**
 * Browser Form Tool
 *
 * Handles form control operations:
 * - select: Select option in dropdown
 * - check: Check a checkbox
 * - uncheck: Uncheck a checkbox
 * - upload: Upload file(s) to input
 */

import { createTool } from '../../tools';
import { createError } from '../errors';
import { formInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserFormTool = createTool({
  id: 'browser_form',
  description: `Handle form controls. Actions:
- select: Select an option in a dropdown by index
- check: Check a checkbox
- uncheck: Uncheck a checkbox
- upload: Upload file(s) to a file input`,
  inputSchema: formInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);

    try {
      return await browser.form(input as Parameters<typeof browser.form>[0]);
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

      // Element blocked
      if (msg.includes('intercepts pointer events')) {
        return createError(
          'element_blocked',
          'Element is blocked by another element (modal/overlay).',
          'Take a new snapshot to see what is blocking. Dismiss any modals.',
        );
      }

      // Timeout
      if (msg.includes('Timeout') || msg.includes('timeout')) {
        return createError('timeout', 'Form operation timed out.', 'Take a new snapshot - the element may have moved.');
      }

      // Generic error
      return createError(
        'browser_error',
        `Form operation failed: ${msg}`,
        'Take a new snapshot to see the current page state.',
      );
    }
  },
});
