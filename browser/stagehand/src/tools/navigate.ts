/**
 * stagehand_navigate - Navigate to a URL
 */

import { createTool } from '@mastra/core/tools';
import type { StagehandBrowser } from '../stagehand-browser';
import { navigateInputSchema } from '../schemas';
import { STAGEHAND_TOOLS } from './constants';

export function createNavigateTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.NAVIGATE,
    description: 'Navigate the browser to a URL.',
    inputSchema: navigateInputSchema,
    execute: async input => {
      await browser.ensureReady();
      return await browser.navigate(input);
    },
  });
}
