/**
 * Browser Storage Tool
 *
 * Manage browser storage:
 * - get_local_storage: Get localStorage value
 * - set_local_storage: Set localStorage value
 * - clear_local_storage: Clear all localStorage
 * - get_session_storage: Get sessionStorage value
 * - set_session_storage: Set sessionStorage value
 * - clear_session_storage: Clear all sessionStorage
 */

import { createTool } from '../../tools';
import { storageInputSchema } from '../schemas';
import { requireBrowser } from './helpers';

export const browserStorageTool = createTool({
  id: 'browser_storage',
  description: `Manage browser storage. Actions:
- get_local_storage: Get localStorage value by key
- set_local_storage: Set localStorage key/value
- clear_local_storage: Clear all localStorage
- get_session_storage: Get sessionStorage value by key
- set_session_storage: Set sessionStorage key/value
- clear_session_storage: Clear all sessionStorage`,
  inputSchema: storageInputSchema,
  execute: async (input, context) => {
    const browser = requireBrowser(context);
    return browser.storage(input as Parameters<typeof browser.storage>[0]);
  },
});
