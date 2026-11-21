import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Knowledge, knowledgeMemoryScopes } from '@mastra/core/knowledge';
import { afterAll, describe, expect, it, vi } from 'vitest';

import { LibSQLStore } from '../../index';

const dir = mkdtempSync(join(tmpdir(), 'knowledge-activity-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const memory = knowledgeMemoryScopes();
const alex = { author: 'agent:alex' };

async function at<T>(ms: number, write: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ms);
  try {
    return await write();
  } finally {
    vi.useRealTimers();
  }
}

describe('knowledge_activity on a LibSQL file: dated order through every resume', () => {
  it('walks tied and out-of-order changes in (createdAt, id) order with since-only and until-only bounds', async () => {
    const storage = new LibSQLStore({ id: 'activity', url: `file:${join(dir, 'activity.db')}` });
    const knowledge = new Knowledge({
      storage,
      tools: { read: { maxTokens: 100 }, write: false },
      scopes: { ...memory, 'org:$orgId': { ...memory['org:$orgId'], access: [{ principal: 'self', role: 'owner' }] } },
    });
    const store = await knowledge.getStorage();
    const T0 = Date.UTC(2031, 5, 1);
    const acme = await at(
      T0 - 60_000,
      async () =>
        (
          await store.materializeScope({
            address: 'org:acme',
            declaration: 'org:$orgId',
            name: 'org:acme',
            provenance: alex,
          })
        ).scope,
    );
    const page = (ms: number, name: string) =>
      at(ms, () => store.createPage({ parentId: acme.id, name, provenance: alex }));
    const log = await page(T0 + 1, 'Log');
    const note = (ms: number, text: string) =>
      at(ms, () => store.addNote({ pageId: log.id, text, stampScopeIds: [acme.id], mentions: [], provenance: alex }));
    await note(T0 + 9000, 'late ' + 'x'.repeat(300));
    // Three changes in one millisecond.
    await at(T0 + 5000, async () => {
      for (const i of [1, 2, 3]) {
        await store.addNote({
          pageId: log.id,
          text: `tie ${i} ` + 'y'.repeat(200),
          stampScopeIds: [acme.id],
          mentions: [],
          provenance: alex,
        });
      }
    });
    // A clock stepped back: these ids sort after every earlier id, their createdAt before the ties.
    await note(T0 + 2000, 'stepped back A');
    await note(T0 + 2000, 'stepped back B ' + 'z'.repeat(250));
    await note(T0 + 7000, 'middle');

    // Fixed host principals (#30996) stand in for an agent run holding org:acme.
    const tools = knowledge.createTools({ principals: ['org:acme'] });
    const call = (input: Record<string, unknown>) =>
      tools.knowledge_activity!.execute!(input as never, {} as never) as Promise<any>;

    const { events } = await store.listPageActivity({ read: 'all', since: new Date(T0), limit: 100 });
    const reference = events.map(event => event.createdAt.toISOString() + '|' + event.id);
    // The fixture really puts id order against createdAt order.
    const byId = [...events]
      .sort((a, b) => (a.id < b.id ? 1 : -1))
      .map(event => event.createdAt.toISOString() + '|' + event.id);
    expect(byId).not.toEqual(reference);
    expect(events.filter(event => event.createdAt.getTime() === T0 + 5000)).toHaveLength(3);

    for (const bound of [{ since: new Date(T0).toISOString() }, { until: new Date(T0 + 60_000).toISOString() }]) {
      const walked: string[] = [];
      let cursor: string | undefined;
      let calls = 0;
      do {
        const result = await call({ ...bound, limit: 3, ...(cursor ? { cursor } : {}) });
        calls++;
        expect(result.changes.length).toBeGreaterThan(0);
        walked.push(...result.changes.map((change: any) => `${change.at}|${change.action}|${change.note?.ref ?? ''}`));
        cursor = result.cursor;
      } while (cursor && calls < 50);
      const range = 'since' in bound ? { since: new Date(T0) } : { until: new Date(T0 + 60_000) };
      const expected = (await store.listPageActivity({ read: 'all', ...range, limit: 100 })).events.map(
        event => `${event.createdAt.toISOString()}|${event.action}|${event.noteId ?? ''}`,
      );
      expect(walked).toEqual(expected);
      expect(calls).toBeGreaterThan(2);
    }
  });
});
