// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useWorkspaceFile } from '../use-workspace';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

describe('useWorkspaceFile', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps UTF-8 and base64 reads in separate query cache entries', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    server.use(
      http.get(`${BASE_URL}/api/workspaces/ws-1/fs/read`, ({ request }) => {
        const url = new URL(request.url);
        const encoding = url.searchParams.get('encoding');
        const content = encoding === 'base64' ? 'JVBERi0xLjQ=' : 'plain text';

        return HttpResponse.json({
          path: 'reports/output.pdf',
          content,
          type: 'file',
          size: 12,
          mimeType: 'application/pdf',
        });
      }),
    );

    const { result, rerender } = renderHook(
      ({ encoding }: { encoding: 'utf-8' | 'base64' }) =>
        useWorkspaceFile('reports/output.pdf', {
          encoding,
          workspaceId: 'ws-1',
        }),
      {
        initialProps: { encoding: 'utf-8' as const },
        wrapper: wrapper(queryClient),
      },
    );

    await waitFor(() => expect(result.current.data?.content).toBe('plain text'));

    rerender({ encoding: 'base64' });
    await waitFor(() => expect(result.current.data?.content).toBe('JVBERi0xLjQ='));

    expect(queryClient.getQueryData(['workspace', 'file', 'reports/output.pdf', 'ws-1', 'utf-8'])).toMatchObject({
      content: 'plain text',
    });
    expect(queryClient.getQueryData(['workspace', 'file', 'reports/output.pdf', 'ws-1', 'base64'])).toMatchObject({
      content: 'JVBERi0xLjQ=',
    });
  });
});
