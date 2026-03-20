/**
 * Browser Form Tool
 *
 * Handles form control operations:
 * - check: Check a checkbox or radio button
 * - uncheck: Uncheck a checkbox
 * - select: Select option from dropdown
 * - upload: Upload files to file input
 */

import { createTool } from '../../tools';
import { formInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserFormTool = createTool({
  id: 'browser_form',
  description: `Interact with form controls. Actions:
- check: Check a checkbox or radio button
- uncheck: Uncheck a checkbox
- select: Select option from dropdown
- upload: Upload files to file input`,
  inputSchema: formInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.form(input as Parameters<typeof browser.form>[0]);
  },
});
