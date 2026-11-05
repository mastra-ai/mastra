import html from '../apps-dist/greeting.html?raw';

/** An MCP App resource: register it under a `ui://` URI in `MCPServer`'s `appResources`. */
export interface McpAppResource {
  name: string;
  description: string;
  html: string;
}

/**
 * Greets the `name` argument of the tool that opens it, fetching the greeting from the server's
 * app-only `getGreeting` tool, and lets the user post a reply to the conversation.
 */
export const greetingApp: McpAppResource = {
  name: 'Greeting',
  description: 'Greets someone by name',
  html,
};
