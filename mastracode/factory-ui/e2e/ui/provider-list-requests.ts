import { onTestFinished } from 'vitest';

import { server } from './msw-server';

const PROVIDER_LIST_PATHS = [
  /^\/web\/(github|gitlab)\/projects\/[^/]+\/(issues|prs)$/,
  /^\/web\/(gitlab|linear|jira|incidentio)\/issues$/,
];

/**
 * Records the path of every request for a provider's issue or pull request list until the test
 * finishes. The server no longer serves those lists, so no handler answers them: this listens for
 * the request itself, which a test asserting the UI never asks for a list checks stays empty.
 */
export function recordProviderListRequests(): string[] {
  const paths: string[] = [];
  const record = ({ request }: { request: Request }) => {
    const { pathname } = new URL(request.url);
    if (PROVIDER_LIST_PATHS.some(pattern => pattern.test(pathname))) paths.push(pathname);
  };
  server.events.on('request:start', record);
  onTestFinished(() => {
    server.events.removeListener('request:start', record);
  });
  return paths;
}
