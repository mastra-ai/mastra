/**
 * browser_snapshot - Get accessibility tree snapshot
 */

import { createTool } from '../../tools';
import { snapshotInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
import { handleBrowserError } from './error-handler';
import { ensureBrowserReady } from './helpers';

export const browserSnapshotTool = createTool({
  id: BROWSER_TOOLS.SNAPSHOT,
  description:
    'Get the accessibility tree snapshot of the current page. Returns element refs (@e1, @e2, etc.) that can be used with other tools.',
  inputSchema: snapshotInputSchema,
  execute: async (input, context) => {
    const browser = await ensureBrowserReady(context);
    try {
      return await browser.snapshot(input);
    } catch (error) {
      return handleBrowserError(error, 'Snapshot');
    }
  },
});
