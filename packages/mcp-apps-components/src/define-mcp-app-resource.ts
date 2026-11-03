import { fileURLToPath } from 'node:url';
import type { McpAppResource } from './types';

export type McpAppResourceOptions = {
  /**
   * Origins the app fetches from, e.g. `['https://api.example.com']`. Hosts block every other
   * connection, so this must include the origin of any `baseUrl` the tool returns.
   */
  connectDomains: string[];
  name?: string;
  description?: string;
};

/**
 * Declares the server side of an app built from `src/apps/<app>`: a function returning the
 * resource to register under a `ui://` URI in `MCPServer`'s `appResources`.
 */
export function defineMcpAppResource(app: string, defaults: { name: string; description: string }) {
  // Bundled into dist/index.{js,cjs}, next to the built dist/<app>.html.
  const htmlPath = fileURLToPath(new URL(`./${app}.html`, import.meta.url));

  return ({
    connectDomains,
    name = defaults.name,
    description = defaults.description,
  }: McpAppResourceOptions): McpAppResource => ({
    name,
    description,
    htmlPath,
    meta: { csp: { connectDomains } },
  });
}
