import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReconcilePendingInstallOnFocus } from '../use-reconcile-pending-install-on-focus';
import { activeDiscordInstallation } from './fixtures/channel-installations';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const wrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

const reconcileHandler = (onReconcile: () => void) =>
  http.post(`${BASE_URL}/api/channels/discord/agent-1/reconcile`, () => {
    onReconcile();
    return HttpResponse.json(activeDiscordInstallation);
  });

afterEach(() => cleanup());

describe('useReconcilePendingInstallOnFocus', () => {
  describe('when the agent has a pending installation', () => {
    it('posts a reconcile for the agent on window focus', async () => {
      const onReconcile = vi.fn();
      server.use(reconcileHandler(onReconcile));

      renderHook(
        () => useReconcilePendingInstallOnFocus({ platform: 'discord', agentId: 'agent-1', hasPendingInstall: true }),
        {
          wrapper,
        },
      );

      fireEvent.focus(window);

      await waitFor(() => expect(onReconcile).toHaveBeenCalledTimes(1));
    });

    it('stops reconciling once the hook unmounts', async () => {
      const onReconcile = vi.fn();
      server.use(reconcileHandler(onReconcile));

      const { unmount } = renderHook(
        () => useReconcilePendingInstallOnFocus({ platform: 'discord', agentId: 'agent-1', hasPendingInstall: true }),
        { wrapper },
      );
      unmount();

      fireEvent.focus(window);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onReconcile).not.toHaveBeenCalled();
    });
  });

  describe('when the agent has no pending installation', () => {
    it('does not reconcile on window focus', async () => {
      const onReconcile = vi.fn();
      server.use(reconcileHandler(onReconcile));

      renderHook(
        () => useReconcilePendingInstallOnFocus({ platform: 'discord', agentId: 'agent-1', hasPendingInstall: false }),
        { wrapper },
      );

      fireEvent.focus(window);
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(onReconcile).not.toHaveBeenCalled();
    });
  });
});
