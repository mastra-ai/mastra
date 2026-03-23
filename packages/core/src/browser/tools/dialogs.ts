/**
 * Browser Dialogs Tool
 *
 * Handle browser dialogs (alerts, confirms, prompts):
 * - set_handler: Set auto-response for dialogs
 * - clear_handler: Clear dialog handler
 */

import { createTool } from '../../tools';
import { dialogsInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserDialogsTool = createTool({
  id: 'browser_dialogs',
  description: `Handle browser dialogs. Actions:
- set_handler: Set auto-response for dialogs (accept/dismiss with optional text)
- clear_handler: Clear dialog handler to use default behavior`,
  inputSchema: dialogsInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.dialogs(input as Parameters<typeof browser.dialogs>[0]);
  },
});
