// @vitest-environment jsdom
import type * as PlaygroundUi from '@mastra/playground-ui';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateSkill } from '../use-create-skill';
import { server } from '@/test/msw-server';

vi.mock('@mastra/playground-ui', async importOriginal => {
  const actual = await importOriginal<typeof PlaygroundUi>();
  return {
    ...actual,
    toast: { success: vi.fn(), error: vi.fn() },
  };
});

const writeFileMock = vi.fn();
vi.mock('@/domains/workspace/hooks', () => ({
  useWriteWorkspaceFile: () => ({ mutateAsync: writeFileMock }),
}));

const hasPermissionMock = vi.fn();
vi.mock('@/domains/auth/hooks', () => ({
  usePermissions: () => ({ hasPermission: hasPermissionMock }),
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

const baseFiles = [
  { id: 'f1', type: 'file' as const, name: 'SKILL.md', content: '# Title\nDo X' },
  { id: 'f2', type: 'file' as const, name: 'LICENSE', content: 'MIT' },
];

beforeEach(() => {
  writeFileMock.mockReset();
  hasPermissionMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCreateSkill', () => {
  it('writes skill files to the workspace and creates the DB record', async () => {
    hasPermissionMock.mockReturnValue(true);
    writeFileMock.mockResolvedValue(undefined);

    let receivedBody: any = null;
    server.use(
      http.post(`${BASE_URL}/api/stored/skills`, async ({ request }) => {
        receivedBody = await request.json();
        return HttpResponse.json({
          id: 'created',
          name: receivedBody.name,
          description: receivedBody.description,
          instructions: receivedBody.instructions,
          status: 'active',
          createdAt: '',
          updatedAt: '',
        });
      }),
    );

    const { result } = renderHook(() => useCreateSkill(), { wrapper: wrapper() });

    const created = await result.current.mutateAsync({
      name: 'My Skill',
      description: 'desc',
      visibility: 'private',
      workspaceId: 'ws-1',
      files: baseFiles,
    });

    expect(created.id).toBe('created');
    expect(writeFileMock).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      path: 'skills/SKILL.md',
      content: '# Title\nDo X',
      recursive: true,
    });
    expect(writeFileMock).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      path: 'skills/LICENSE',
      content: 'MIT',
      recursive: true,
    });
    expect(receivedBody).toMatchObject({
      name: 'My Skill',
      description: 'desc',
      visibility: 'private',
      files: baseFiles,
    });
  });

  it('skips workspace file writes when the caller lacks workspaces:write', async () => {
    hasPermissionMock.mockReturnValue(false);

    server.use(
      http.post(`${BASE_URL}/api/stored/skills`, () =>
        HttpResponse.json({ id: 's', name: 'n', description: 'd', status: 'active', createdAt: '', updatedAt: '' }),
      ),
    );

    const { result } = renderHook(() => useCreateSkill(), { wrapper: wrapper() });

    await result.current.mutateAsync({
      name: 'n',
      description: 'd',
      workspaceId: 'ws-1',
      files: baseFiles,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it('still creates the DB record when workspace file writes fail', async () => {
    hasPermissionMock.mockReturnValue(true);
    writeFileMock.mockRejectedValue(new Error('disk full'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    let createCalled = false;
    server.use(
      http.post(`${BASE_URL}/api/stored/skills`, () => {
        createCalled = true;
        return HttpResponse.json({
          id: 's',
          name: 'n',
          description: 'd',
          status: 'active',
          createdAt: '',
          updatedAt: '',
        });
      }),
    );

    const { result } = renderHook(() => useCreateSkill(), { wrapper: wrapper() });

    await result.current.mutateAsync({
      name: 'n',
      description: 'd',
      workspaceId: 'ws-1',
      files: baseFiles,
    });

    expect(createCalled).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
