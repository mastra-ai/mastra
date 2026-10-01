/**
 * browser_webmcp - Discover and call WebMCP tools exposed by the current page.
 *
 * Supports both the W3C `navigator.modelContext` draft and in-page MCP
 * servers over the MCP-B Tab transport, scoped by `webmcp.protocols`. Only
 * added to the toolset when the AgentBrowser is constructed with
 * `webmcp: { enabled: true }`.
 */
import { createTool } from '@mastra/core/tools';
import type { AgentBrowser } from '../agent-browser';
import { webmcpInputSchema } from '../schemas';
import { BROWSER_TOOLS } from './constants';

export function createWebmcpTool(browser: AgentBrowser) {
  return createTool({
    id: BROWSER_TOOLS.WEBMCP,
    description:
      'Discover and invoke WebMCP tools exposed by the current page. ' +
      'Pass action="list" first to see what tools the page offers, then action="call" with the exact tool name and arguments. ' +
      'Supports pages that use navigator.modelContext (W3C draft) or an in-page MCP server (MCP-B Tab transport).',
    inputSchema: webmcpInputSchema,
    execute: async (input, { agent }) => {
      const threadId = agent?.threadId;
      browser.setCurrentThread(threadId);
      await browser.ensureReady();
      if (input.action === 'list') {
        return browser.listWebMcpTools(threadId);
      }
      return browser.callWebMcpTool({ toolName: input.toolName, args: input.args }, threadId);
    },
  });
}
