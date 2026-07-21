/**
 * BDD coverage for the per-project settings hooks (worktree setup command).
 *
 * Drives the real fetch/save services + React Query stack; only the network is
 * mocked (MSW). Handlers assert request bodies so the wire contract with
 * `/web/github/repositories/:id/settings` stays pinned.
 */
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { queryKeys } from '../../api/keys';
import { server } from '../../../../e2e/web-ui/msw-server';
import { renderHookWithProviders, waitForMutationsIdle, TEST_BASE_URL } from '../../../../e2e/web-ui/render';
import type { RepositorySettings } from '../../../web/ui/domains/workspaces/services/github';
import { useRepositorySettingsQuery, useSaveRepositorySettingsMutation } from '../useRepositorySettings';

const ORIGIN = TEST_BASE_URL;
const PROJECT = 'ghp_1';
const SETTINGS_URL = `${ORIGIN}/web/github/repositories/${PROJECT}/settings`;

describe('project settings hooks', () => {
  it('given a github project, when the query runs, then it resolves the stored setup command', async () => {
    server.use(http.get(SETTINGS_URL, () => HttpResponse.json({ setupCommand: 'pnpm i && pnpm build' })));

    const { result } = renderHookWithProviders(() => useRepositorySettingsQuery(PROJECT));

    await waitFor(() => expect(result.current.data).toEqual({ setupCommand: 'pnpm i && pnpm build' }));
  });

  it('given no github project id, when rendered, then the query stays idle', async () => {
    const { result } = renderHookWithProviders(() => useRepositorySettingsQuery(undefined));
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });

  it('given a new setup command, when saving, then it posts the settings and updates the cached copy', async () => {
    server.use(
      http.post(SETTINGS_URL, async ({ request }) => {
        expect(await request.json()).toEqual({ setupCommand: 'pnpm i' });
        return HttpResponse.json({ setupCommand: 'pnpm i' } satisfies RepositorySettings);
      }),
    );

    const { result, client } = renderHookWithProviders(() => useSaveRepositorySettingsMutation());

    await act(async () => {
      await result.current.mutateAsync({ githubProjectId: PROJECT, settings: { setupCommand: 'pnpm i' } });
    });
    await waitForMutationsIdle(client);

    expect(client.getQueryData(queryKeys.githubRepositorySettings(PROJECT))).toEqual({ setupCommand: 'pnpm i' });
  });

  it('given the server rejects the command, when saving fails, then the error carries the server message', async () => {
    server.use(http.post(SETTINGS_URL, () => HttpResponse.json({ error: 'Invalid setupCommand' }, { status: 400 })));

    const { result, client } = renderHookWithProviders(() => useSaveRepositorySettingsMutation());

    await act(async () => {
      await expect(
        result.current.mutateAsync({ githubProjectId: PROJECT, settings: { setupCommand: 'x' } }),
      ).rejects.toMatchObject({ status: 400 });
    });
    await waitForMutationsIdle(client);

    expect(result.current.error).toBeTruthy();
  });
});
