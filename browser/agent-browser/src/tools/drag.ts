/**
 * browser_drag - Drag an element to another element
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { dragInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createDragTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.DRAG,
    description: 'Drag an element to another element.',
    inputSchema: dragInputSchema,
    execute: async (input, { agent }) => {
      browser.setCurrentThread(agent?.threadId);
      await browser.ensureReady();
      return browser.drag(input);
    },
  });
}
