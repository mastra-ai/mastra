// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateSkill } from '../use-update-skill';
import { server } from '@/test/msw-server';

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = await importOriginal<typeof PlaygroundUi>();
  return {
    ...actual,
    toast: { success: toastSuccess, error: toastError },
  };
});

vi.mock('@/domains/workspace/hooks', () => ({
  useWriteWorkspaceFile: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock('@/domains/auth/hooks', () => ({
  usePermissions: () => ({ hasPermission: () => false }),
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUpdateSkill', () => {
  it('sends only the fields the caller provided (sparse body)', async () => {
    let body: any = null;
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/skill-1`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' });
      }),
    );

    const { result } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });

    await result.current.mutateAsync({ id: 'skill-1', name: 'Renamed' });

    expect(body).toEqual({ name: 'Renamed' });
    expect(body).not.toHaveProperty('description');
    expect(body).not.toHaveProperty('visibility');
    expect(body).not.toHaveProperty('files');
  });

  it('shows success toast by default and suppresses it in silent mode', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () =>
        HttpResponse.json({ id: 'skill-1', status: 'active', createdAt: '', updatedAt: '' }),
      ),
    );

    const { result: defaultResult } = renderHook(() => useUpdateSkill(), { wrapper: wrapper() });
    await defaultResult.current.mutateAsync({ id: 'skill-1', name: 'A' });
    expect(toastSuccess).toHaveBeenCalledTimes(1);

    toastSuccess.mockReset();
    const { result: silentResult } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: wrapper() });
    await silentResult.current.mutateAsync({ id: 'skill-1', name: 'B' });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('suppresses error toast in silent mode', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/skill-1`, () => HttpResponse.json({ error: 'boom' }, { status: 500 })),
    );

    const { result } = renderHook(() => useUpdateSkill({ silent: true }), { wrapper: wrapper() });
    await expect(result.current.mutateAsync({ id: 'skill-1', name: 'X' })).rejects.toThrow();
    expect(toastError).not.toHaveBeenCalled();
  });
});
