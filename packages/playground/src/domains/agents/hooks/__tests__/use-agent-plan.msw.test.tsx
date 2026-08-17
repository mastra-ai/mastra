// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { useAgentPlanToolNames } from '../use-agent-plan';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
}

describe('useAgentPlanToolNames', () => {
  it('maps user-defined tool names to the controlled submit_plan id', async () => {
    server.use(
      http.get(`${BASE_URL}/api/agents/:agentId`, ({ params }) => {
        if (params.agentId !== 'plan-agent') {
          return HttpResponse.json({ message: 'Agent not found' }, { status: 404 });
        }

        return HttpResponse.json({
          tools: {
            userDefinedAlias: { id: 'submit_plan' },
            unrelatedTool: { id: 'unrelated_tool' },
          },
        });
      }),
    );

    const { result } = renderHook(
      () => useAgentPlanToolNames({ agentId: 'plan-agent', requestContext: { tenantId: 'tenant-1' } }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.data).toEqual(['userDefinedAlias']));
  });
});
