import greetingHtml from '../apps-dist/greeting.html?raw';
import observabilityWidgetHtml from '../apps-dist/observability-widget.html?raw';

export { QUERY_OBSERVABILITY_TOOL } from './apps/observability-widget/tool';

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
  html: greetingHtml,
};

/**
 * Draws one Studio dashboard widget. The tool that opens it returns `{ widget, datePreset? }` as
 * structured content; the app reads every metric, score and aggregate through the server's
 * app-only `queryObservability` tool (`{ action, args }` in, where `action` is a `MastraClient`
 * observability method, and `{ data }` out).
 */
export const observabilityWidgetApp: McpAppResource = {
  name: 'Observability widget',
  description: 'Draws one observability dashboard widget',
  html: observabilityWidgetHtml,
};
