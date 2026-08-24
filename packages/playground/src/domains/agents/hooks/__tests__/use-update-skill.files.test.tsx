import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUpdateSkill } from '../use-update-skill';
import type { InMemoryFileNode } from '@/domains/agents/components/agent-edit-page/utils/form-validation';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';
const SKILL_ID = 'skill-files';
const WORKSPACE_ID = 'ws-1';
const WRITE_URL = `${BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/write`;

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('@mastra/playground-ui/utils/toast', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const authDisabled: AuthCapabilities = { enabled: false, login: null };

/** RBAC on, granting exactly the permissions listed. */
const rbacWith = (permissions: string[]): AuthCapabilities => ({
  enabled: true,
  login: null,
  user: { id: 'user-1' },
  capabilities: { user: true, session: true, sso: false, rbac: true, acl: false },
  access: { roles: ['member'], permissions },
});

/**
 * The skill file tree the editor keeps in memory. `skill-md` holds the
 * instructions and `license-md` the licence — both are read back out on save.
 */
const skillFiles = (overrides: { instructions?: string; license?: string } = {}): InMemoryFileNode[] => [
  {
    id: 'root',
    name: 'my-skill',
    type: 'folder',
    children: [
      { id: 'skill-md', name: 'SKILL.md', type: 'file', content: overrides.instructions ?? 'Do the thing.' },
      ...(overrides.license === undefined
        ? []
        : [{ id: 'license-md', name: 'LICENSE', type: 'file' as const, content: overrides.license }]),
    ],
  },
];

const renderUpdate = ({
  capabilities = authDisabled,
  silent = true,
}: { capabilities?: AuthCapabilities; silent?: boolean } = {}) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MastraReactProvider>
  );

  return { ...renderHook(() => useUpdateSkill({ silent }), { wrapper }), queryClient };
};

/** Captures the PATCH body and every workspace write the save issues. */
const captureSave = () => {
  const writes: Array<{ path: string; content: string; recursive?: boolean }> = [];
  let body: Record<string, unknown> | null = null;

  server.use(
    http.post(WRITE_URL, async ({ request }) => {
      writes.push((await request.json()) as { path: string; content: string; recursive?: boolean });
      return HttpResponse.json({ success: true });
    }),
    http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
      body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: SKILL_ID });
    }),
  );

  return { writes, body: () => body };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useUpdateSkill, when the caller sends a file tree', () => {
  beforeEach(() => {
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)));
  });

  it('writes every file in the tree to the workspace under skills/', async () => {
    const captured = captureSave();
    const { result } = renderUpdate();

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: skillFiles() });
    });

    expect(captured.writes.map(write => write.path)).toEqual(['skills/my-skill/SKILL.md']);
    expect(captured.writes[0].content).toBe('Do the thing.');
  });

  it('creates the parent directories on the way', async () => {
    const captured = captureSave();
    const { result } = renderUpdate();

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: skillFiles() });
    });

    expect(captured.writes[0].recursive).toBe(true);
  });

  it('walks nested folders and joins their names into the path', async () => {
    const captured = captureSave();
    const { result } = renderUpdate();

    await act(async () => {
      await result.current.mutateAsync({
        id: SKILL_ID,
        workspaceId: WORKSPACE_ID,
        files: [
          {
            id: 'root',
            name: 'my-skill',
            type: 'folder',
            children: [
              { id: 'skill-md', name: 'SKILL.md', type: 'file', content: 'top' },
              {
                id: 'refs',
                name: 'references',
                type: 'folder',
                children: [{ id: 'nested', name: 'guide.md', type: 'file', content: 'nested' }],
              },
            ],
          },
        ],
      });
    });

    expect(captured.writes.map(write => write.path).sort()).toEqual([
      'skills/my-skill/SKILL.md',
      'skills/my-skill/references/guide.md',
    ]);
  });

  it('skips a file node that has no content yet', async () => {
    const captured = captureSave();
    const { result } = renderUpdate();

    await act(async () => {
      await result.current.mutateAsync({
        id: SKILL_ID,
        workspaceId: WORKSPACE_ID,
        files: [
          {
            id: 'root',
            name: 'my-skill',
            type: 'folder',
            children: [
              { id: 'skill-md', name: 'SKILL.md', type: 'file', content: 'top' },
              { id: 'empty', name: 'TODO.md', type: 'file' },
            ],
          },
        ],
      });
    });

    expect(captured.writes.map(write => write.path)).toEqual(['skills/my-skill/SKILL.md']);
  });

  it('skips an empty folder rather than writing a path for it', async () => {
    const captured = captureSave();
    const { result } = renderUpdate();

    await act(async () => {
      await result.current.mutateAsync({
        id: SKILL_ID,
        workspaceId: WORKSPACE_ID,
        files: [{ id: 'root', name: 'my-skill', type: 'folder' }],
      });
    });

    expect(captured.writes).toEqual([]);
  });

  describe('when the workspace write fails', () => {
    it('still saves to the database, since that is the source of truth', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      let body: Record<string, unknown> | null = null;
      server.use(
        http.post(WRITE_URL, () => new HttpResponse(null, { status: 500 })),
        http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: SKILL_ID });
        }),
      );

      const { result } = renderUpdate();
      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: skillFiles() });
      });

      expect(body).not.toBeNull();
      expect(warn).toHaveBeenCalled();
      expect(String(warn.mock.calls[0][0])).toContain('saving to DB only');
    });
  });

  describe('when there is nothing to write to the workspace', () => {
    it('skips the write because no workspace was chosen', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, files: skillFiles() });
      });

      expect(captured.writes).toEqual([]);
      expect(captured.body()).not.toBeNull();
    });

    it('skips the write because the tree is empty', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: [] });
      });

      expect(captured.writes).toEqual([]);
      expect(captured.body()).not.toBeNull();
    });

    it('skips the write when the caller may not write to workspaces', async () => {
      const captured = captureSave();
      const { result, queryClient } = renderUpdate({ capabilities: rbacWith(['stored-skills:write']) });
      // Until capabilities resolve, RBAC is unknown and permission checks pass
      // through — so the denial is only observable once they have landed.
      await waitFor(() => expect(queryClient.getQueryData(['auth', 'capabilities'])).toBeDefined());

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: skillFiles() });
      });

      expect(captured.writes).toEqual([]);
      expect(captured.body()).not.toBeNull();
    });

    it('performs the write when the caller may write to workspaces', async () => {
      const captured = captureSave();
      const { result, queryClient } = renderUpdate({ capabilities: rbacWith(['workspaces:write']) });
      await waitFor(() => expect(queryClient.getQueryData(['auth', 'capabilities'])).toBeDefined());

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, workspaceId: WORKSPACE_ID, files: skillFiles() });
      });

      await waitFor(() => expect(captured.writes).toHaveLength(1));
    });
  });

  describe('the body it sends to the database', () => {
    it('reads the instructions out of the tree when the caller sends none', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({
          id: SKILL_ID,
          files: skillFiles({ instructions: 'From the tree.' }),
        });
      });

      expect(captured.body()).toMatchObject({ instructions: 'From the tree.' });
    });

    it('prefers the instructions the caller passes over the tree', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({
          id: SKILL_ID,
          instructions: 'Explicit.',
          files: skillFiles({ instructions: 'From the tree.' }),
        });
      });

      expect(captured.body()).toMatchObject({ instructions: 'Explicit.' });
    });

    it('carries the licence out of the tree', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, files: skillFiles({ license: 'MIT' }) });
      });

      expect(captured.body()).toMatchObject({ license: 'MIT' });
    });

    it('omits the licence when the tree has none', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, files: skillFiles() });
      });

      expect(captured.body()).not.toHaveProperty('license');
    });

    it('omits the licence when the licence file is blank', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, files: skillFiles({ license: '   ' }) });
      });

      expect(captured.body()).not.toHaveProperty('license');
    });

    it('sends the tree itself alongside the extracted fields', async () => {
      const captured = captureSave();
      const files = skillFiles();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, files });
      });

      expect(captured.body()).toMatchObject({ files });
    });

    it('leaves instructions out entirely when there is no tree and no explicit value', async () => {
      const captured = captureSave();
      const { result } = renderUpdate();

      await act(async () => {
        await result.current.mutateAsync({ id: SKILL_ID, name: 'Renamed' });
      });

      expect(captured.body()).toEqual({ name: 'Renamed' });
    });
  });
});

describe('useUpdateSkill, what it tells the user', () => {
  beforeEach(() => {
    server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(authDisabled)));
  });

  it('confirms a successful save', async () => {
    captureSave();
    const { result } = renderUpdate({ silent: false });

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, name: 'Renamed' });
    });

    expect(toastSuccess).toHaveBeenCalledWith('Skill updated');
  });

  it('reports the server message when the save fails', async () => {
    server.use(
      http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () =>
        HttpResponse.json({ message: 'name already taken' }, { status: 409 }),
      ),
    );
    const { result } = renderUpdate({ silent: false });

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, name: 'Renamed' }).catch(() => {});
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(String(toastError.mock.calls[0][0])).toContain('Failed to update skill:');
    expect(String(toastError.mock.calls[0][0])).toContain('name already taken');
  });

  it('stays quiet on failure in silent mode', async () => {
    server.use(http.patch(`${BASE_URL}/api/stored/skills/${SKILL_ID}`, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderUpdate({ silent: true });

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, name: 'Renamed' }).catch(() => {});
    });

    expect(toastError).not.toHaveBeenCalled();
  });

  it('re-reads both the skill list and the skill detail after a save', async () => {
    captureSave();
    const { result, queryClient } = renderUpdate();
    queryClient.setQueryData(['stored-skills'], { skills: [] });
    queryClient.setQueryData(['stored-skill', SKILL_ID], { id: SKILL_ID });

    await act(async () => {
      await result.current.mutateAsync({ id: SKILL_ID, name: 'Renamed' });
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(['stored-skills'])?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(['stored-skill', SKILL_ID])?.isInvalidated).toBe(true);
    });
  });
});
