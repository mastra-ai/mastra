/**
 * stagehand_extract - Extract structured data from a page
 */

import { createTool } from '@mastra/core/tools';
import { extractInputSchema } from '../schemas';
import type { StagehandBrowser } from '../stagehand-browser';
import { STAGEHAND_TOOLS } from './constants';

export function createExtractTool(browser: StagehandBrowser) {
  return createTool({
    id: STAGEHAND_TOOLS.EXTRACT,
    description:
      'Extract structured data from the page using natural language. Can optionally provide a JSON schema for the expected data structure.',
    inputSchema: extractInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return await browser.extract(input, threadId);
    },
  });
}
