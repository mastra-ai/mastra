import { waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import { queryKeys } from '../../api/keys';
import type { SessionRowsRequest, SessionRowsResponse, SessionRowWire } from '../../api/types';
import { createQueryClient } from '../../query-client';
import { useSessionRowsQuery } from '../useSessionRows';
import { removeCachedSession } from '../useWorkspaces';

const FACTORY_ID = 'factory-1';
const ROWS_URL = `${TEST_BASE_URL}/web/factory/projects/:factoryId/session-rows`;
const REQUEST: SessionRowsRequest = {
  sort: 'activity',
  groupBy: 'none',
  owner: 'all',
  children: false,
  pin: [],
  windows: {},
};

function row(sessionId: string, fields: Partial<SessionRowWire> = {}): SessionRowWire {
  return {
    session: {
      id: `row-${sessionId}`,
      sessionId,
      projectRepositoryId: 'repo-1',
      userId: 'user-1',
      branch: `user/session-${sessionId}`,
      title: sessionId,
      visibility: 'org',
      createdAt: '2026-07-18T00:00:00.000Z',
    },
    origin: 'user',
    status: 'idle',
    pinned: false,
    updatedAt: '2026-07-18T00:00:00.000Z',
    ...fields,
  };
}

function rowsAnswer(rows: SessionRowWire[], groupTotal: number): SessionRowsResponse {
  return {
    total: groupTotal,
    matching: groupTotal,
    groups: [{ key: 'all', total: groupTotal, rows }],
    boards: [],
    owners: [],
    settling: false,
  };
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('removeCachedSession', () => {
  it('drops the row and counts one session fewer, even when a rows read was already in flight', async () => {
    const gate = deferred();
    let requests = 0;
    const answer = rowsAnswer([row('session-1'), row('session-2')], 3);
    server.use(
      http.get(ROWS_URL, async () => {
        requests += 1;
        if (requests > 1) await gate.promise;
        return HttpResponse.json(answer);
      }),
    );
    const client = createQueryClient();
    const { result } = renderHookWithProviders(() => useSessionRowsQuery(FACTORY_ID, REQUEST), { client });
    await waitFor(() => expect(result.current.shown?.groups[0]?.rows).toHaveLength(2));

    void client.refetchQueries({ queryKey: queryKeys.sessionRowsRoot(FACTORY_ID) });
    await waitFor(() => expect(requests).toBe(2));
    removeCachedSession(client, FACTORY_ID, 'session-1');

    const shown = () => result.current.shown;
    await waitFor(() =>
      expect(shown()?.groups[0]?.rows.map(listed => listed.session.sessionId)).toEqual(['session-2']),
    );
    expect(shown()?.groups[0]?.total).toBe(2);
    expect({ total: shown()?.total, matching: shown()?.matching }).toEqual({ total: 2, matching: 2 });

    gate.resolve();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(shown()?.groups[0]?.rows.map(listed => listed.session.sessionId)).toEqual(['session-2']);
  });

  it('keeps a card’s row while another of its sessions is left, and drops it with the last', async () => {
    const client = createQueryClient();
    const key = queryKeys.sessionRows(FACTORY_ID, REQUEST);
    client.setQueryData(
      key,
      rowsAnswer([row('session-1', { itemId: 'item-1', cardSessionIds: ['session-1', 'session-2'] })], 1),
    );

    removeCachedSession(client, FACTORY_ID, 'session-2');
    expect(client.getQueryData<SessionRowsResponse>(key)?.groups[0]?.rows[0]?.cardSessionIds).toEqual(['session-1']);

    removeCachedSession(client, FACTORY_ID, 'session-1');
    expect(client.getQueryData<SessionRowsResponse>(key)).toMatchObject({ total: 0, matching: 0, groups: [] });
  });

  it('stops linking a folded card to its deleted session, and still counts the card while another session is left', () => {
    const client = createQueryClient();
    const key = queryKeys.sessionRows(FACTORY_ID, REQUEST);
    const card = { origin: 'factory' as const, itemId: 'item-1', cardSessionIds: ['session-1', 'session-2'] };
    client.setQueryData(key, rowsAnswer([row('session-1', card), row('session-3')], 2));

    removeCachedSession(client, FACTORY_ID, 'session-1');

    const answer = client.getQueryData<SessionRowsResponse>(key);
    expect(answer?.groups[0]?.rows.map(listed => listed.session.sessionId)).toEqual(['session-3']);
    expect({ total: answer?.total, groupTotal: answer?.groups[0]?.total }).toEqual({ total: 2, groupTotal: 2 });
  });

  it("shows a card's next session in its row once the session it showed is deleted, keeping the rest nested", () => {
    const client = createQueryClient();
    const key = queryKeys.sessionRows(FACTORY_ID, { ...REQUEST, children: true });
    const sibling = (sessionId: string) =>
      row(sessionId, { origin: 'factory', itemId: 'item-1', phaseLabel: 'Review' });
    client.setQueryData(
      key,
      rowsAnswer(
        [
          row('session-1', {
            origin: 'factory',
            itemId: 'item-1',
            childRows: [sibling('session-2'), sibling('session-3')],
          }),
        ],
        1,
      ),
    );

    removeCachedSession(client, FACTORY_ID, 'session-1');

    const answer = client.getQueryData<SessionRowsResponse>(key);
    const shown = answer?.groups[0]?.rows[0];
    expect(shown?.session.sessionId).toBe('session-2');
    expect(shown?.phaseLabel).toBeUndefined();
    expect(shown?.childRows?.map(child => child.session.sessionId)).toEqual(['session-3']);
    expect(answer?.total).toBe(1);
  });

  it("drops a person's session row with its followed cards' sessions when the person's session is deleted", () => {
    const client = createQueryClient();
    const key = queryKeys.sessionRows(FACTORY_ID, { ...REQUEST, children: true });
    const followed = row('session-2', { origin: 'factory', itemId: 'item-1' });
    client.setQueryData(key, rowsAnswer([row('session-1', { childRows: [followed] })], 1));

    removeCachedSession(client, FACTORY_ID, 'session-1');

    expect(client.getQueryData<SessionRowsResponse>(key)).toMatchObject({ total: 0, matching: 0, groups: [] });
  });
});
