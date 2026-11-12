import { describe, expect, it } from 'vitest';

import { boardPhasesQuerySchema } from '../routes/contracts.js';
import { testCard } from '../routes/test-utils.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { workItemFilterOptions } from './board-filter-options.js';
import { boardPhases } from './board-phases.js';

const BOARD = { id: 'work', phases: ['intake', 'planning', 'done'] };

/** The view a reader's query string asks for, parsed as the route parses it. */
function view(query: Record<string, string | string[]> = {}) {
  const { cards: _cards, ...parsed } = boardPhasesQuerySchema.parse(query);
  return parsed;
}

function listedIds(list: readonly Card[], query: Record<string, string | string[]> = {}, userId = 'u1') {
  const { body } = boardPhases(list, BOARD, view(query), userId);
  return Object.fromEntries(body.phases.map(entry => [entry.phase, entry.cards.map(card => card.id)]));
}

const entered = (stage: string, enteredAt: string, by = 'u1') => ({ stage, enteredAt, by });

describe('boardPhases', () => {
  it('orders a phase by each card’s latest entry into it, not its first', () => {
    const cameBack = testCard('came-back', {
      stages: ['planning'],
      stageHistory: [
        entered('planning', '2026-03-01T00:00:00.000Z'),
        entered('intake', '2026-03-02T00:00:00.000Z'),
        entered('planning', '2026-03-05T00:00:00.000Z'),
      ],
    });
    const stayed = testCard('stayed', {
      stages: ['planning'],
      stageHistory: [entered('planning', '2026-03-03T00:00:00.000Z')],
    });

    expect(listedIds([stayed, cameBack]).planning).toEqual(['came-back', 'stayed']);
  });

  it('places a card that never entered its phase by when it was created', () => {
    const noHistory = testCard('no-history', { createdAt: new Date('2026-03-04T00:00:00.000Z') });
    const before = testCard('before', { stageHistory: [entered('intake', '2026-03-03T00:00:00.000Z')] });
    const after = testCard('after', { stageHistory: [entered('intake', '2026-03-05T00:00:00.000Z')] });

    expect(listedIds([before, noHistory, after]).intake).toEqual(['after', 'no-history', 'before']);
  });

  it('puts first the cards the reader last moved into the phase, each group in recent order', () => {
    const list = [
      testCard('a', { stageHistory: [entered('intake', '2026-03-01T00:00:00.000Z', 'u1')] }),
      testCard('b', { stageHistory: [entered('intake', '2026-03-02T00:00:00.000Z', 'u2')] }),
      testCard('c', { stageHistory: [entered('intake', '2026-03-03T00:00:00.000Z', 'u1')] }),
      // Moved here by u1 first, then by u2: the latest entry decides whose it is.
      testCard('d', {
        stageHistory: [
          entered('intake', '2026-03-01T12:00:00.000Z', 'u1'),
          entered('intake', '2026-03-04T00:00:00.000Z', 'u2'),
        ],
      }),
    ];

    expect(listedIds(list, { sort: 'recent-mine' }, 'u1').intake).toEqual(['c', 'a', 'd', 'b']);
    expect(listedIds(list, { sort: 'recent-mine' }, 'u2').intake).toEqual(['d', 'b', 'c', 'a']);
    expect(listedIds(list, { sort: 'recent-mine', limit: '1' }, 'u2').intake).toEqual(['d']);
  });

  it('breaks a tie on the creation instant by id, descending, in both creation orders', () => {
    const list = [testCard('a'), testCard('c'), testCard('b')];

    expect(listedIds(list, { sort: 'created-newest' }).intake).toEqual(['c', 'b', 'a']);
    expect(listedIds(list, { sort: 'created-oldest' }).intake).toEqual(['c', 'b', 'a']);
  });

  it('does not deepen a phase for a card the view filters out', () => {
    const list = [
      testCard('old', { title: 'Rename the palette', stageHistory: [entered('intake', '2026-03-01T00:00:00.000Z')] }),
      testCard('mid', { title: 'Fix the login', stageHistory: [entered('intake', '2026-03-02T00:00:00.000Z')] }),
      testCard('new', { title: 'Fix the logout', stageHistory: [entered('intake', '2026-03-03T00:00:00.000Z')] }),
    ];
    const item = '00000000-0000-4000-8000-000000000001';
    const withIds = list.map((card, nth) => (nth === 0 ? { ...card, id: item } : card));

    expect(listedIds(withIds, { limit: '1', item }).intake).toEqual(['new', 'mid', item]);
    expect(listedIds(withIds, { limit: '1', item, q: 'fix' }).intake).toEqual(['new']);
  });

  it('deepens a phase whose id is as long as a board allows', () => {
    const longest = 'p'.repeat(128);
    const list = [testCard('a', { stages: [longest] }), testCard('b', { stages: [longest] })];

    const { body } = boardPhases(
      list,
      { id: 'work', phases: [longest] },
      view({ limit: '1', window: [`${longest}:2`] }),
      'u1',
    );

    expect(body.phases[0]?.cards.map(card => card.id)).toEqual(['b', 'a']);
  });

  it('shows a card held by none of the board’s phases under the first one only', () => {
    const { body } = boardPhases([testCard('lost', { stages: ['retired-lane'] })], BOARD, view(), 'u1');

    expect(body.phases.map(entry => [entry.phase, entry.total])).toEqual([
      ['intake', 1],
      ['planning', 0],
      ['done', 0],
    ]);
  });

  it('files a Slack thread under Slack, not under cards filed by hand', () => {
    const list = [
      testCard('by-hand'),
      testCard('thread', { externalSource: { integrationId: 'slack', type: 'slack-thread', externalId: 'C1:1.2' } }),
    ];

    expect(listedIds(list, { source: ['manual'] }).intake).toEqual(['by-hand']);
    expect(listedIds(list, { source: ['slack'] }).intake).toEqual(['thread']);
  });

  it('counts as having worked on a card whoever filed it, moved it in or out, or started a session on it', () => {
    const list = [
      testCard('filed', { createdBy: 'u2' }),
      testCard('left', {
        createdBy: 'factory',
        stageHistory: [{ ...entered('planning', '2026-03-01T00:00:00.000Z', 'agent:triage'), exitedBy: 'u2' }],
      }),
      testCard('started', {
        createdBy: 'factory',
        sessions: { execute: { sessionId: 's1', branch: 'factory/1', threadId: 't1', startedBy: 'u2' } },
      }),
      testCard('automation', { createdBy: 'factory' }),
      testCard('other', { createdBy: 'u3' }),
    ];

    expect(listedIds(list, { worked: ['factory:u2'] }).intake.toSorted()).toEqual(['filed', 'left', 'started']);
  });

  it('names as author the person who filed a card by hand, and no Factory user for a provider’s card', () => {
    const list = [
      testCard('by-hand', { createdBy: 'u2' }),
      testCard('synced', {
        createdBy: 'u2',
        externalSource: { integrationId: 'github', type: 'issue', externalId: '7' },
        workItem: { ...testCard('synced').workItem, provider: 'github', author: 'octocat' },
      }),
    ];

    expect(listedIds(list, { author: ['factory:u2'] }).intake).toEqual(['by-hand']);
    expect(listedIds(list, { author: ['github:octocat'] }).intake).toEqual(['synced']);
  });

  it('names every card of the answer once, listed cards before related ones', () => {
    const parent = testCard('parent', { stageHistory: [entered('intake', '2026-03-01T00:00:00.000Z')] });
    const child = testCard('child', {
      parentWorkItemId: 'parent',
      stageHistory: [entered('intake', '2026-03-02T00:00:00.000Z')],
    });

    const { body, named } = boardPhases([parent, child], BOARD, view({ limit: '1' }), 'u1');

    expect(body.related).toEqual([{ id: 'parent', changedAt: null }]);
    expect(named.map(card => card.id)).toEqual(['child', 'parent']);
  });
});

describe('workItemFilterOptions', () => {
  it('offers one entry per person, however many cards name them and in whatever case', () => {
    const issue = (id: string, author: string) =>
      testCard(id, {
        externalSource: { integrationId: 'github', type: 'issue', externalId: id },
        workItem: { ...testCard(id).workItem, provider: 'github', author },
      });

    expect(workItemFilterOptions([issue('1', 'Octocat'), issue('2', 'octocat'), issue('3', 'hubot')]).people).toEqual([
      { id: 'github:hubot', name: 'hubot', source: 'github' },
      { id: 'github:octocat', name: 'Octocat', source: 'github' },
    ]);
  });
});
