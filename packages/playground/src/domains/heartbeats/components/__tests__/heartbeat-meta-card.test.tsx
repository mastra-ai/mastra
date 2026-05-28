// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { makeHeartbeat } from '../../__tests__/fixtures/heartbeats';
import { HeartbeatMetaCard } from '../heartbeat-meta-card';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const makeWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MastraReactProvider baseUrl={BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>{children}</MemoryRouter>
        </QueryClientProvider>
      </MastraReactProvider>
    );
  };
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HeartbeatMetaCard', () => {
  it('renders the thread title when memory returns one, linked to the chat thread', async () => {
    const heartbeat = makeHeartbeat({ agentId: 'chef', threadId: 'thread-1' });
    server.use(
      http.get(`${BASE_URL}/api/memory/threads/thread-1`, () =>
        HttpResponse.json({
          id: 'thread-1',
          resourceId: 'chef',
          title: 'Dinner planning',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    );

    render(<HeartbeatMetaCard heartbeat={heartbeat} />, { wrapper: makeWrapper() });

    const link = await screen.findByTestId('heartbeat-thread-link');
    await waitFor(() => expect(link.textContent).toBe('Dinner planning'));
    // The link href is governed by the host paths.agentThreadLink resolver;
    // we only assert that the heartbeat detail wires through it.
    expect(link.tagName).toBe('A');
  });

  it('falls back to the threadId when no title is available', async () => {
    const heartbeat = makeHeartbeat({ agentId: 'chef', threadId: 'thread-untitled' });
    server.use(
      http.get(`${BASE_URL}/api/memory/threads/thread-untitled`, () =>
        HttpResponse.json({
          id: 'thread-untitled',
          resourceId: 'chef',
          title: '',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
    );

    render(<HeartbeatMetaCard heartbeat={heartbeat} />, { wrapper: makeWrapper() });

    const link = await screen.findByTestId('heartbeat-thread-link');
    expect(link.textContent).toBe('thread-untitled');
  });

  it('inline-edits cron and PATCHes to the dedicated heartbeats route', async () => {
    const heartbeat = makeHeartbeat({ agentId: 'chef', id: 'hb_chef_thread-1', cron: '*/30 * * * * *' });
    let receivedBody: Record<string, unknown> | undefined;

    server.use(
      http.get(`${BASE_URL}/api/memory/threads/:threadId`, () =>
        HttpResponse.json({
          id: 'thread-1',
          resourceId: 'chef',
          title: 'A',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
      http.patch(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...heartbeat, cron: '0 * * * *' });
      }),
    );

    render(<HeartbeatMetaCard heartbeat={heartbeat} />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('heartbeat-cron-edit'));

    const input = await screen.findByTestId<HTMLInputElement>('heartbeat-cron-input');
    fireEvent.change(input, { target: { value: '0 * * * *' } });
    fireEvent.click(screen.getByTestId('heartbeat-cron-save'));

    await waitFor(() => expect(receivedBody).toEqual({ cron: '0 * * * *' }));
  });

  it('inline-edits prompt and PATCHes the new value', async () => {
    const heartbeat = makeHeartbeat({
      agentId: 'chef',
      id: 'hb_chef_thread-1',
      prompt: 'check in with the user',
    });
    let receivedBody: Record<string, unknown> | undefined;

    server.use(
      http.get(`${BASE_URL}/api/memory/threads/:threadId`, () =>
        HttpResponse.json({
          id: 'thread-1',
          resourceId: 'chef',
          title: 'A',
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      ),
      http.patch(`${BASE_URL}/api/agents/chef/heartbeats/hb_chef_thread-1`, async ({ request }) => {
        receivedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...heartbeat, prompt: 'remind about the stew' });
      }),
    );

    render(<HeartbeatMetaCard heartbeat={heartbeat} />, { wrapper: makeWrapper() });

    fireEvent.click(screen.getByTestId('heartbeat-prompt-edit'));

    const textarea = await screen.findByTestId<HTMLTextAreaElement>('heartbeat-prompt-input');
    fireEvent.change(textarea, { target: { value: 'remind about the stew' } });
    fireEvent.click(screen.getByTestId('heartbeat-prompt-save'));

    await waitFor(() => expect(receivedBody).toEqual({ prompt: 'remind about the stew' }));
  });
});
