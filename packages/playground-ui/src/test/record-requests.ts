import { onTestFinished } from 'vitest';

import { server } from './msw-server';

/**
 * Records the path of every request that reaches the network during the current test.
 *
 * Data-agnostic components (the `*View` ones) must render from their props alone, so a host with
 * its own fetching (e.g. an MCP server app) can compose them. Asserting on what crossed the wire
 * proves it: an internal fetch shows up here even when React Query swallows its error.
 */
export function recordRequests(): string[] {
  const paths: string[] = [];
  const listener = ({ request }: { request: Request }) => {
    paths.push(new URL(request.url).pathname);
  };
  server.events.on('request:start', listener);
  onTestFinished(() => {
    server.events.removeListener('request:start', listener);
  });
  return paths;
}
