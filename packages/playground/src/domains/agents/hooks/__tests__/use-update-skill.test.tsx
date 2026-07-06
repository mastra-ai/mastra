import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateSkill } from '../use-update-skill';
import { writeAllowedCapabilities } from './fixtures/auth';
import { server } from '@/test/msw-server';

// `toast` is a third-party presentational util from @mastra/playground-ui, not
// one of our data hooks/services/auth gating, so spying on it is allowed.
const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: { success: toastSuccess, error: toastError },
}));

const BASE_URL = 'http://localhost:4111';

const wrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );
};

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  // The real `usePermissions` inside the hook fetches auth capabilities.
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUpdateSkill', () => {
  describe('when the caller provides only some fields', () => {
    it('sends a sparse PATCH body containing only the provided fields', async () => {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' });
        }),
      );

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });

      await act(async () => {
        await result.current.mutateAsync({ id: 'skill-1', name: 'Renamed' });
      });

      expect(body).toEqual({ name: 'Renamed' });
    });

    it('omits fields the caller did not provide from the PATCH body', async () => {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' });
        }),
      );

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });

      await act(async () => {
        await result.current.mutateAsync({ id: 'skill-1', name: 'Renamed' });
      });

      expect(body).not.toHaveProperty('description');
      expect(body).not.toHaveProperty('visibility');
      expect(body).not.toHaveProperty('files');
    });
  });

  describe('when the update succeeds in default (non-silent) mode', () => {
    it('shows a success toast', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
          HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' }),
        ),
      );

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });
      await act(async () => {
        await result.current.mutateAsync({ id: 'skill-1', name: 'A' });
      });

      expect(toastSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('when the update succeeds in silent mode', () => {
    it('does not show a success toast', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
          HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' }),
        ),
      );

      const { result } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: wrapper() });
      await act(async () => {
        await result.current.mutateAsync({ id: 'skill-1', name: 'B' });
      });

      expect(toastSuccess).not.toHaveBeenCalled();
    });
  });

  describe('when the update fails in silent mode', () => {
    it('rejects without showing an error toast', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );

      const { result } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync({ id: 'skill-1', name: 'X' })).rejects.toThrow();
      });
      expect(toastError).not.toHaveBeenCalled();
    });
  });
});
