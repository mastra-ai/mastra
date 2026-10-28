/**
 * browser_webmcp_discover — Opt-in WebMCP tool discovery.
 *
 * Added only when the AgentBrowser is constructed with
 * `webmcp: { enabled: true, toolDiscovery: 'manual' }`. The agent calls this
 * tool to attach the current page's WebMCP tools to its own toolset; the
 * attached tools surface on the next step as first-class `page_*` tools via
 * `browser.prepareStep`.
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { webmcpDiscoverInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';

export function createWebmcpDiscoverTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.WEBMCP_DISCOVER,
    description:
      "Attach the current page's WebMCP tools to the agent so they become callable on the next step. " +
      'Pass no arguments to attach every tool the page exposes, or pass `names` to attach a subset. ' +
      'Returns the attached tool ids (e.g. `page_add_to_cart`) and short descriptions.',
    inputSchema: webmcpDiscoverInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      return browser.attachWebMcpTools({ names: input.names }, threadId);
    },
  });
}
