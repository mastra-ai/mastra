/**
 * browser_upload - Upload file(s) to a file input
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { uploadInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createUploadTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.UPLOAD,
    description: 'Upload file(s) to a file input element.',
    inputSchema: uploadInputSchema,
    execute: async input => {
      await browser.ensureReady();
      return browser.upload(input);
    },
  });
}
