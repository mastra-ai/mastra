import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { workBoardCatalog } from '../../../e2e/ui/board-catalog';
import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL, waitForMutationsIdle } from '../../../e2e/ui/render';
import type { SessionRowsRequest, SessionRowWire } from '../../api/types';
import type { WorkItem } from '../../ui/domains/factory/services/workItems';
import { useFactoryDecisionAction } from '../useFactoryDecisions';
import { useSessionRowsQuery } from '../useSessionRows';
import { useDeleteWorkItemMutation, useTransitionWorkItemMutation, useUpdateWorkItemMutation } from '../useWorkItems';

const PROJECT_ID = 'fp-1';
const CARD_ID = 'fix-login';
const SESSION_ID = 'build-session';
const VIEW: SessionRowsRequest = {
  sort: 'activity',
  groupBy: 'none',
  owner: 'all',
  children: false,
  pin: [],
  windows: {},
};
const CREATED_AT = '2026-09-04T10:00:00.000Z';

const heldCard: WorkItem = {
  id: CARD_ID,
  orgId: 'org-1',
  createdBy: 'user-1',
  githubProjectId: PROJECT_ID,
  board: 'work',
  source: 'manual',
  sourceKey: `manual:${CARD_ID}`,
  parentWorkItemId: null,
  title: 'Fix login',
  url: null,
  stages: ['execute'],
  stageHistory: [],
  sessions: {
    work: { sessionId: SESSION_ID, branch: 'factory/issue-1', threadId: `${SESSION_ID}-thread`, startedBy: 'user-1' },
  },
  metadata: {},
  triageType: null,
  acceptedAt: null,
  description: null,
  revision: 1,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};

/** The project as the server holds it: one session working on one card, which a decision may hold for a person. */
function serveProject({ decision }: { decision?: 'proposed' }) {
  let card: Pick<WorkItem, 'title' | 'stages' | 'revision'> | undefined = heldCard;
  let decisionStatus = decision;
  const listedCards = () =>
    card ? [{ ...heldCard, ...card, factoryProjectId: PROJECT_ID, externalSource: null }] : [];
  server.use(
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/boards`, () => HttpResponse.json(workBoardCatalog)),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/sessions`, () =>
      HttpResponse.json({
        sessions: [
          {
            sessionId: SESSION_ID,
            projectRepositoryId: 'ghp-1',
            title: 'Build fix login',
            branch: 'factory/issue-1',
            materializedAt: CREATED_AT,
            createdAt: CREATED_AT,
          },
        ],
      }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items`, () =>
      HttpResponse.json({ workItems: listedCards() }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/decisions`, () =>
      HttpResponse.json({
        decisions: decisionStatus ? [{ id: 'decision-1', workItemId: CARD_ID, status: decisionStatus }] : [],
      }),
    ),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/work-items/${CARD_ID}/transition`, () => {
      card = card && { ...card, stages: ['done'], revision: card.revision + 1 };
      return HttpResponse.json({
        result: { status: 'accepted', transitionId: 't-1', itemId: CARD_ID, revision: 2, stage: 'done', decisions: [] },
      });
    }),
    http.patch(`${TEST_BASE_URL}/web/factory/work-items/${CARD_ID}`, async ({ request }) => {
      const { title } = z.object({ title: z.string() }).parse(await request.json());
      card = card && { ...card, title, revision: card.revision + 1 };
      return HttpResponse.json({ workItem: listedCards()[0] });
    }),
    http.delete(`${TEST_BASE_URL}/web/factory/work-items/${CARD_ID}`, () => {
      card = undefined;
      return HttpResponse.json({ ok: true });
    }),
    http.post(`${TEST_BASE_URL}/web/factory/projects/${PROJECT_ID}/decisions/decision-1/approve`, () => {
      decisionStatus = undefined;
      return HttpResponse.json({ decision: { id: 'decision-1', workItemId: CARD_ID, status: 'pending' } });
    }),
  );
}

describe('useSessionRowsQuery', () => {
  it.each<{
    change: string;
    decision?: 'proposed';
    read: (row: SessionRowWire | undefined) => unknown;
    before: unknown;
    after: unknown;
    useWrite: () => () => Promise<unknown>;
  }>([
    {
      change: 'its card moved to Done',
      read: row => row?.status,
      before: 'idle',
      after: 'done',
      useWrite: () => {
        const move = useTransitionWorkItemMutation(PROJECT_ID);
        return () => move.mutateAsync({ item: heldCard, board: 'work', stage: 'done' });
      },
    },
    {
      change: 'its card renamed',
      read: row => row?.card?.title,
      before: 'Fix login',
      after: 'Fix sign-in',
      useWrite: () => {
        const update = useUpdateWorkItemMutation(PROJECT_ID);
        return () => update.mutateAsync({ id: CARD_ID, patch: { title: 'Fix sign-in' } });
      },
    },
    {
      change: 'its card deleted',
      read: row => row?.itemId,
      before: CARD_ID,
      after: undefined,
      useWrite: () => {
        const remove = useDeleteWorkItemMutation(PROJECT_ID);
        return () => remove.mutateAsync(CARD_ID);
      },
    },
    {
      change: "its card's proposed run approved",
      decision: 'proposed',
      read: row => row?.status,
      before: 'waiting',
      after: 'idle',
      useWrite: () => {
        const approve = useFactoryDecisionAction(PROJECT_ID, 'approve');
        return () => approve.mutateAsync('decision-1');
      },
    },
  ])(
    'shows a session row with $change as soon as the write lands',
    async ({ decision, read, before, after, useWrite }) => {
      serveProject({ decision });
      const { result, client } = renderHookWithProviders(() => ({
        rows: useSessionRowsQuery(PROJECT_ID, VIEW),
        write: useWrite(),
      }));
      const row = () => read(result.current.rows.shown?.groups[0]?.rows[0]);
      await waitFor(() => expect(row()).toBe(before));

      await result.current.write();
      await waitForMutationsIdle(client);

      await waitFor(() => expect(row()).toBe(after));
    },
  );
});
