import type { McpAppResource } from './types';

export type McpAppResourceOptions = {
  name?: string;
  description?: string;
};

/**
 * Declares the server side of an app built from `src/apps/<app>`: a function returning the
 * resource to register under a `ui://` URI in `MCPServer`'s `appResources`.
 *
 * The page is passed inline rather than as a file path: deployers bundle this package into the
 * server output, where no sibling HTML file exists (and Cloudflare has no filesystem at all).
 * Apps reach Mastra through their server's tools, never the network, so the resource keeps
 * hosts' default CSP.
 */
export function defineMcpAppResource(html: string, defaults: Required<McpAppResourceOptions>) {
  return ({
    name = defaults.name,
    description = defaults.description,
  }: McpAppResourceOptions = {}): McpAppResource => ({
    name,
    description,
    html,
  });
}
