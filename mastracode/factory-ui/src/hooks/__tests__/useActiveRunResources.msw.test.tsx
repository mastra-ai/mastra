import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { TEST_BASE_URL } from '../../../e2e/ui/render';
import { ApiConfigProvider } from '../../api/config';
import { createQueryClient } from '../../query-client';
import { useActiveRunResources } from '../useActiveRunResources';

const controllerId = 'code';
const sessionId = 'session-1';
const OTHER_BASE_URL = 'http://localhost:4222';

function stubActiveRuns(baseUrl: string, resourceIds: string[]) {
  server.use(
    http.get(`${baseUrl}/api/agent-controller/${controllerId}/active-runs`, () =>
      HttpResponse.json({
        runs: resourceIds.map(resourceId => ({ runId: `run-${resourceId}`, resourceId, threadId: resourceId })),
      }),
    ),
  );
}

describe('active run lookup across Factory servers', () => {
  it('scopes cached runs to the server they came from', async () => {
    stubActiveRuns(TEST_BASE_URL, [sessionId]);
    stubActiveRuns(OTHER_BASE_URL, []);
    const client = createQueryClient();
    const wrapper = (baseUrl: string) =>
      function Providers({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={client}>
            <ApiConfigProvider baseUrl={baseUrl}>{children}</ApiConfigProvider>
          </QueryClientProvider>
        );
      };
    const hook = () => useActiveRunResources({ agentControllerId: controllerId, resourceIds: [sessionId] });

    const running = renderHook(hook, { wrapper: wrapper(TEST_BASE_URL) });
    const idle = renderHook(hook, { wrapper: wrapper(OTHER_BASE_URL) });

    await waitFor(() => expect(running.result.current[sessionId]).toBe(true));
    await waitFor(() => expect(idle.result.current[sessionId]).toBe(false));
  });
});
