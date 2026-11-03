import { fileURLToPath } from 'node:url';
import type { McpAppResource } from './types';

export type McpAppResourceOptions = {
  name?: string;
  description?: string;
};

/**
 * Declares the server side of an app built from `src/apps/<app>`: a function returning the
 * resource to register under a `ui://` URI in `MCPServer`'s `appResources`. Apps reach Mastra
 * through the `mastraApi` tool, never the network, so the resource keeps hosts' default CSP.
 */
export function defineMcpAppResource(app: string, defaults: Required<McpAppResourceOptions>) {
  // Bundled into dist/<app>.{js,cjs}, next to the built dist/<app>.html.
  const htmlPath = fileURLToPath(new URL(`./${app}.html`, import.meta.url));

  return ({
    name = defaults.name,
    description = defaults.description,
  }: McpAppResourceOptions = {}): McpAppResource => ({
    name,
    description,
    htmlPath,
  });
}
