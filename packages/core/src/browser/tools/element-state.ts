/**
 * Browser Element State Tool
 *
 * Check element states:
 * - is_visible: Check if element is visible
 * - is_enabled: Check if element is enabled
 * - is_checked: Check if checkbox/radio is checked
 */

import { createTool } from '../../tools';
import { elementStateInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserElementStateTool = createTool({
  id: 'browser_element_state',
  description: `Check element states. Actions:
- is_visible: Check if element is visible
- is_enabled: Check if element is enabled/disabled
- is_checked: Check if checkbox/radio is checked`,
  inputSchema: elementStateInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.elementState(input as Parameters<typeof browser.elementState>[0]);
  },
});
