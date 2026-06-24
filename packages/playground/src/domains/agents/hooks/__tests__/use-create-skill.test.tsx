import type { CreateStoredSkillParams } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCreateSkill } from '../use-create-skill';
import { writeAllowedCapabilities, writeDeniedCapabilities } from './fixtures/auth';
import { createdSkill, workspaceWriteOk } from './fixtures/skills';
import { usePermissions } from '@/domains/auth/hooks';
import type { AuthCapabilities } from '@/domains/auth/types';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL as BASE_URL, waitForMutationsIdle } from '@/test/render';

const seedAuth = (capabilities: AuthCapabilities) => {
  server.use(http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json(capabilities)));
};

/** Captures the `POST /stored/skills` body and resolves the created record. */
const seedSkillCreate = () => {
  const calls: CreateStoredSkillParams[] = [];
  server.use(
    http.post(`${BASE_URL}/api/stored/skills`, async ({ request }) => {
      calls.push((await request.json()) as CreateStoredSkillParams);
      return HttpResponse.json(createdSkill);
    }),
  );
  return calls;
};

/** Captures every `POST /workspaces/:id/fs/write` body. */
const seedWorkspaceWrite = (status = 200) => {
  const writes: { path: string; content: string; recursive?: boolean }[] = [];
  server.use(
    http.post(`${BASE_URL}/api/workspaces/:workspaceId/fs/write`, async ({ request }) => {
      const body = (await request.json()) as { path: string; content: string; recursive?: boolean };
      writes.push(body);
      if (status >= 400) {
        return new HttpResponse(null, { status });
      }
      return HttpResponse.json(workspaceWriteOk);
    }),
  );
  return writes;
};

const baseFiles = [
  { id: 'f1', type: 'file' as const, name: 'SKILL.md', content: '# Title\nDo X' },
  { id: 'f2', type: 'file' as const, name: 'LICENSE', content: 'MIT' },
];

/**
 * Renders the mutation alongside `usePermissions` so a test can wait for auth
 * capabilities to resolve before mutating — otherwise the `workspaces:write`
 * gate reads the pre-load default and the write step runs incorrectly.
 */
const renderCreateSkill = () =>
  renderHookWithProviders(() => ({ create: useCreateSkill(), permissions: usePermissions() }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCreateSkill', () => {
  describe('when the caller can write to the workspace', () => {
    beforeEach(() => {
      seedAuth(writeAllowedCapabilities);
    });

    it('creates the stored skill DB record', async () => {
      const created = seedSkillCreate();
      seedWorkspaceWrite();

      const { result, queryClient } = renderCreateSkill();
      await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));
      let skill: Awaited<ReturnType<typeof result.current.create.mutateAsync>>;
      await act(async () => {
        skill = await result.current.create.mutateAsync({
          name: 'My Skill',
          description: 'desc',
          visibility: 'private',
          workspaceId: 'ws-1',
          files: baseFiles,
        });
      });
      await waitForMutationsIdle(queryClient);

      expect(skill!.id).toBe('created');
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        name: 'My Skill',
        description: 'desc',
        visibility: 'private',
        files: baseFiles,
      });
    });

    it('writes each skill file under the skills/ prefix recursively', async () => {
      seedSkillCreate();
      const writes = seedWorkspaceWrite();

      const { result, queryClient } = renderCreateSkill();
      await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));
      await act(async () => {
        await result.current.create.mutateAsync({
          name: 'My Skill',
          description: 'desc',
          visibility: 'private',
          workspaceId: 'ws-1',
          files: baseFiles,
        });
      });
      await waitForMutationsIdle(queryClient);

      expect(writes).toEqual(
        expect.arrayContaining([
          { path: 'skills/SKILL.md', content: '# Title\nDo X', encoding: undefined, recursive: true },
          { path: 'skills/LICENSE', content: 'MIT', encoding: undefined, recursive: true },
        ]),
      );
    });
  });

  describe('when the caller lacks workspaces:write', () => {
    beforeEach(() => {
      seedAuth(writeDeniedCapabilities);
    });

    it('skips workspace file writes', async () => {
      seedSkillCreate();
      const writes = seedWorkspaceWrite();

      const { result, queryClient } = renderCreateSkill();
      await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));
      await act(async () => {
        await result.current.create.mutateAsync({ name: 'n', description: 'd', workspaceId: 'ws-1', files: baseFiles });
      });

      await waitForMutationsIdle(queryClient);
      expect(writes).toHaveLength(0);
    });
  });

  describe('when workspace file writes fail', () => {
    beforeEach(() => {
      seedAuth(writeAllowedCapabilities);
    });

    it('still persists the skill record', async () => {
      const created = seedSkillCreate();
      seedWorkspaceWrite(500);

      const { result, queryClient } = renderCreateSkill();
      await waitFor(() => expect(result.current.permissions.isLoading).toBe(false));

      await act(() =>
        result.current.create.mutateAsync({ name: 'n', description: 'd', workspaceId: 'ws-1', files: baseFiles }),
      );

      await waitForMutationsIdle(queryClient);
      expect(result.current.create.isSuccess).toBe(true);

      expect(created).toHaveLength(1);
    });
  });
});
