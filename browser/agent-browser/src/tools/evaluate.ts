/**
 * browser_evaluate - Execute JavaScript in the browser
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { evaluateInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';
export function createEvaluateTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.EVALUATE,
    description:
      'Execute JavaScript in the browser. Use for complex interactions not covered by other tools. Returns the script result.',
    inputSchema: evaluateInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.evaluate(input, threadId);
    },
  });
}
