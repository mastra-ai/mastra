import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useStoredWorkspaces } from '../use-stored-workspaces';
import { useWorkspaceFiles, useWorkspaceInfo, useWriteWorkspaceFile } from '../use-workspace';
import { useWorkspaceSkills } from '../use-workspace-skills';
import {
  makeStoredWorkspace,
  makeStoredWorkspacesList,
  workspaceFiles,
  workspaceInfo,
  workspaceSkills,
} from './fixtures/editor-workspaces';
import { server } from '@/test/msw-server';
import { makeWrapper, TEST_BASE_URL, waitForMutationsIdle } from '@/test/render';

const WORKSPACE_ID = 'support-workspace';

describe('when Studio users manage editor workspaces', () => {
  it('lists stored and runtime-registered workspaces before loading workspace skills', async () => {
    const onStoredWorkspaces = vi.fn<(url: URL) => void>();
    const onWorkspaceInfo = vi.fn<() => void>();
    const onWorkspaceSkills = vi.fn<() => void>();

    server.use(
      http.get(`${TEST_BASE_URL}/api/stored/workspaces`, ({ request }) => {
        const url = new URL(request.url);
        onStoredWorkspaces(url);
        return HttpResponse.json(
          makeStoredWorkspacesList([
            makeStoredWorkspace({ id: WORKSPACE_ID, name: 'Support workspace', runtimeRegistered: true }),
            makeStoredWorkspace({ id: 'draft-workspace', name: 'Draft workspace', runtimeRegistered: false }),
          ]),
        );
      }),
      http.get(`${TEST_BASE_URL}/api/workspaces/${WORKSPACE_ID}`, () => {
        onWorkspaceInfo();
        return HttpResponse.json(workspaceInfo);
      }),
      http.get(`${TEST_BASE_URL}/api/workspaces/${WORKSPACE_ID}/skills`, () => {
        onWorkspaceSkills();
        return HttpResponse.json(workspaceSkills);
      }),
    );

    const { wrapper } = makeWrapper();
    const stored = renderHook(
      () =>
        useStoredWorkspaces({
          page: 1,
          perPage: 25,
          authorId: 'user-1',
          orderBy: { field: 'updatedAt', direction: 'DESC' },
        }),
      { wrapper },
    );
    const info = renderHook(() => useWorkspaceInfo(WORKSPACE_ID), { wrapper });
    const skills = renderHook(() => useWorkspaceSkills({ workspaceId: WORKSPACE_ID }), { wrapper });

    await waitFor(() => expect(stored.result.current.data?.workspaces[0]?.runtimeRegistered).toBe(true));
    await waitFor(() => expect(info.result.current.data?.capabilities?.hasSkills).toBe(true));
    await waitFor(() => expect(skills.result.current.data?.skills[0]?.name).toBe('refund-policy'));

    expect(onStoredWorkspaces).toHaveBeenCalledTimes(1);
    expect(onStoredWorkspaces.mock.calls[0]?.[0].searchParams.get('authorId')).toBe('user-1');
    expect(onStoredWorkspaces.mock.calls[0]?.[0].searchParams.get('orderBy[field]')).toBe('updatedAt');
    expect(onStoredWorkspaces.mock.calls[0]?.[0].searchParams.get('orderBy[direction]')).toBe('DESC');
    expect(onWorkspaceInfo).toHaveBeenCalledTimes(1);
    expect(onWorkspaceSkills).toHaveBeenCalledTimes(1);
  });

  it('writes skill files through workspace filesystem routes and invalidates file caches', async () => {
    let writeBody: Record<string, unknown> | null = null;
    const onListFiles = vi.fn<(url: URL) => void>();

    server.use(
      http.get(`${TEST_BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/list`, ({ request }) => {
        const url = new URL(request.url);
        onListFiles(url);
        return HttpResponse.json(workspaceFiles);
      }),
      http.post(`${TEST_BASE_URL}/api/workspaces/${WORKSPACE_ID}/fs/write`, async ({ request }) => {
        writeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ success: true, path: '/skills/refund-policy/SKILL.md' });
      }),
    );

    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(['workspace', 'files', '/skills/refund-policy', undefined, WORKSPACE_ID], workspaceFiles);
    queryClient.setQueryData(['workspace', 'file', '/skills/refund-policy/SKILL.md', WORKSPACE_ID], {
      path: '/skills/refund-policy/SKILL.md',
      content: 'old instructions',
      type: 'file',
    });

    const files = renderHook(
      () => useWorkspaceFiles('/skills', { workspaceId: WORKSPACE_ID, recursive: true }),
      { wrapper },
    );
    const writer = renderHook(() => useWriteWorkspaceFile(), { wrapper });

    await waitFor(() => expect(files.result.current.data?.entries[0]?.name).toBe('refund-policy'));
    expect(onListFiles.mock.calls[0]?.[0].searchParams.get('path')).toBe('/skills');
    expect(onListFiles.mock.calls[0]?.[0].searchParams.get('recursive')).toBe('true');

    await act(async () => {
      await writer.result.current.mutateAsync({
        workspaceId: WORKSPACE_ID,
        path: '/skills/refund-policy/SKILL.md',
        content: 'Use the current refund policy.',
        encoding: 'utf-8',
        recursive: true,
      });
    });
    await waitForMutationsIdle(queryClient);

    expect(writeBody).toEqual({
      path: '/skills/refund-policy/SKILL.md',
      content: 'Use the current refund policy.',
      encoding: 'utf-8',
      recursive: true,
    });
    expect(queryClient.getQueryState(['workspace', 'files', '/skills/refund-policy', undefined, WORKSPACE_ID])?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(['workspace', 'file', '/skills/refund-policy/SKILL.md', WORKSPACE_ID])?.isInvalidated).toBe(
      true,
    );
  });
});
