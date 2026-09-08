/**
 * BDD coverage for the Intake swimlane's GitLab gating and feed, mirroring the
 * Linear cases: a board only offers GitLab when intake is enabled, the server
 * reports a working credential, projects are selected, and a source is routed
 * to the Factory project being viewed.
 */
import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { builtinBoardCatalog } from '../../../../../../e2e/ui/board-catalog';
import { server } from '../../../../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../../../../e2e/ui/render';
import type { LinkedRepositoryPayload } from '../../../workspaces/services/github';
import { useBoardIntake } from '../useBoardIntake';

const repository = { projectRepositoryId: 'repo-1', slug: 'acme/app' } as LinkedRepositoryPayload;
const workBoard = builtinBoardCatalog.boards.find(board => board.id === 'work')!;

const gitlabIssue = {
  id: '97!2',
  identifier: 'scraperos/app#2',
  title: 'Verify assignee mutations',
  url: 'https://gitlab.example.com/scraperos/app/-/issues/2',
  author: 'nampn',
  state: 'opened',
  stateType: 'unstarted',
  assignee: 'nampn',
  labels: ['bug'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function stubIntake({
  bindings = [] as Array<{ integrationId: string; sourceId: string; factoryProjectId: string }>,
  factoryIds = ['factory-1', 'factory-2'],
  sourceIds = ['97'] as string[] | null,
  enabled = true,
  connected = true,
  issues = [gitlabIssue],
} = {}) {
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: factoryIds.map(id => ({ id, name: id, repositories: [] })) }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/config`, () =>
      HttpResponse.json({
        config: {
          github: { enabled: false, sourceIds: null },
          linear: { enabled: false, sourceIds: null },
          gitlab: { enabled, sourceIds },
        },
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/intake/bindings`, () => HttpResponse.json({ bindings })),
    http.get(`${TEST_BASE_URL}/web/linear/status`, () =>
      HttpResponse.json({ enabled: false, connected: false, reason: 'disabled' }),
    ),
    http.get(`${TEST_BASE_URL}/web/gitlab/status`, () =>
      HttpResponse.json({
        configured: connected,
        oauthAvailable: true,
        baseUrl: 'https://gitlab.example.com',
        ...(connected ? { connectedAs: 'nampn', credential: 'oauth', instanceVersion: '18.0.2-ee' } : {}),
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/gitlab/issues`, () => HttpResponse.json({ issues, nextCursor: null })),
    http.get(`${TEST_BASE_URL}/web/github/projects/repo-1/issues`, () => HttpResponse.json({ issues: [] })),
  );
}

const renderIntake = (factoryProjectId: string) =>
  renderHookWithProviders(() =>
    useBoardIntake({ factoryProjectId, repository, definition: workBoard, knownSourceKeys: new Set<string>() }),
  );

describe('useBoardIntake — GitLab', () => {
  describe('given a routed GitLab source', () => {
    it('offers the feed on the bound Factory project and lists its issues as candidates', async () => {
      stubIntake({ bindings: [{ integrationId: 'gitlab', sourceId: '97', factoryProjectId: 'factory-1' }] });

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).toContain('gitlab'));
      await waitFor(() => expect(result.current.candidates).toHaveLength(1));
      const candidate = result.current.candidates[0]!;
      expect(candidate.source).toBe('gitlab-issue');
      expect(candidate.sourceKey).toBe('gitlab:97!2');
      expect(candidate.meta).toBe('scraperos/app#2 · opened · nampn');
      // Branch naming reads the iid, so the mapper must keep it.
      expect(candidate.metadata.iid).toBe(2);
    });

    it('withholds the feed from a Factory project the source is not bound to', async () => {
      stubIntake({ bindings: [{ integrationId: 'gitlab', sourceId: '97', factoryProjectId: 'factory-1' }] });

      const { result } = renderIntake('factory-2');

      await waitFor(() => expect(result.current.available).not.toContain('gitlab'));
    });
  });

  describe('given no bindings at all', () => {
    it('offers the feed in a single-Factory org, where the destination is unambiguous', async () => {
      stubIntake({ factoryIds: ['factory-1'] });

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).toContain('gitlab'));
    });

    it('withholds it when several Factories could claim the issues', async () => {
      stubIntake();

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).not.toContain('gitlab'));
    });
  });

  describe('given an incomplete setup', () => {
    it('withholds the feed when intake is switched off', async () => {
      stubIntake({ factoryIds: ['factory-1'], enabled: false });

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).not.toContain('gitlab'));
    });

    it('withholds the feed when no projects are selected', async () => {
      stubIntake({ factoryIds: ['factory-1'], sourceIds: null });

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).not.toContain('gitlab'));
    });

    it('withholds the feed when the server has no working credential', async () => {
      stubIntake({ factoryIds: ['factory-1'], connected: false });

      const { result } = renderIntake('factory-1');

      await waitFor(() => expect(result.current.available).not.toContain('gitlab'));
    });
  });
});
