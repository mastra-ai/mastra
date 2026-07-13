import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUpdateSkill } from '../use-update-skill';
import { writeAllowedCapabilities } from './fixtures/auth';
import { server } from '@/test/msw-server';

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
  // The real `usePermissions` inside the hook fetches auth capabilities.
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(writeAllowedCapabilities)));
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

  describe('when the update succeeds', () => {
    it('returns the updated skill', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
          HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' }),
        ),
      );

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });
      let updated;
      await act(async () => {
        updated = await result.current.mutateAsync({ id: 'skill-1', name: 'A' });
      });

      expect(updated).toMatchObject({ id: 'skill-1', status: 'active' });
    });
  });

  describe('when the update fails', () => {
    it('rejects with the request error', async () => {
      server.use(
        http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
          HttpResponse.json({ error: 'boom' }, { status: 500 }),
        ),
      );

      const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });

      await act(async () => {
        await expect(result.current.mutateAsync({ id: 'skill-1', name: 'X' })).rejects.toThrow();
      });
    });
  });
});
