import { describe, expect, it } from 'vitest';

import { boardPhasesQuerySchema } from '../routes/contracts.js';
import { testCard } from '../routes/test-utils.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { workItemFilterOptions } from './board-filter-options.js';
import { boardPhases } from './board-phases.js';

const BOARD = { id: 'work', phases: ['intake', 'planning', 'done'] };
// The route names a card by the body it sends; nothing here reads the name.
const version = (card: Card) => `version of ${card.id}`;

/** The view a reader's query string asks for, parsed as the route parses it. */
function view(query: Record<string, string | string[]> = {}) {
  const { cards: _cards, ...parsed } = boardPhasesQuerySchema.parse(query);
  return parsed;
}

function listedIds(list: readonly Card[], query: Record<string, string | string[]> = {}, userId = 'u1') {
  const { body } = boardPhases(list, BOARD, view(query), userId, version);
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

  describe('asked for a card (item)', () => {
    const cardId = (nth: number) => `00000000-0000-4000-8000-${String(nth).padStart(12, '0')}`;
    /** `count` cards of one phase; the lower the number, the longer ago it entered. */
    const aged = (count: number, phase = 'intake') =>
      Array.from({ length: count }, (_, nth) =>
        testCard(cardId(nth), {
          title: nth % 2 === 0 ? `Fix ${nth}` : `Rename ${nth}`,
          stages: [phase],
          createdAt: new Date(Date.UTC(2026, 0, 1) + nth * 1_000),
          stageHistory: [entered(phase, new Date(Date.UTC(2026, 2, 1) + nth * 1_000).toISOString())],
        }),
      );
    const ask = (list: readonly Card[], query: Record<string, string | string[]>) =>
      boardPhases(list, BOARD, view(query), 'u1', version);

    it('names the card with its place in the phase, and lists the phase no deeper for it', () => {
      const list = aged(4);

      const { body, named } = ask(list, { limit: '1', item: cardId(0) });

      expect(body.phases[0]?.cards.map(card => card.id)).toEqual([cardId(3)]);
      expect(body.item).toEqual({
        id: cardId(0),
        version: `version of ${cardId(0)}`,
        places: [{ phase: 'intake', position: 3 }],
      });
      expect(named.map(card => card.id)).toEqual([cardId(3), cardId(0)]);
    });

    it('counts the place in the view’s order and among the cards the view keeps', () => {
      const list = aged(4);

      expect(ask(list, { item: cardId(0), sort: 'created-oldest' }).body.item?.places).toEqual([
        { phase: 'intake', position: 0 },
      ]);
      // Cards 2 and 0 match `fix`; card 2 entered later.
      expect(ask(list, { item: cardId(0), q: 'fix' }).body.item?.places).toEqual([{ phase: 'intake', position: 1 }]);
    });

    it('gives a card the view filters out no place, and still names it for its body', () => {
      const list = aged(4);

      const { body, named } = ask(list, { limit: '1', item: cardId(0), q: 'rename' });

      expect(body.item).toMatchObject({ id: cardId(0), places: [] });
      expect(body.phases[0]).toMatchObject({ total: 2, cards: [{ id: cardId(3) }] });
      expect(named.map(card => card.id)).toEqual([cardId(3), cardId(0)]);
    });

    it('gives a card in two phases a place in each', () => {
      const list = [...aged(3), { ...aged(1, 'planning')[0]!, id: cardId(9), stages: ['intake', 'planning'] }];

      expect(ask(list, { item: cardId(9) }).body.item?.places).toEqual([
        { phase: 'intake', position: 3 },
        { phase: 'planning', position: 0 },
      ]);
    });

    it('answers nothing for a card the board does not hold', () => {
      const list = [...aged(2), testCard(cardId(7), { board: 'other' })];

      const { body, named } = ask(list, { item: cardId(7) });

      expect(body).not.toHaveProperty('item');
      expect(named.map(card => card.id)).toEqual([cardId(1), cardId(0)]);
    });

    it('names the cards related to the asked card', () => {
      const [oldest, ...rest] = aged(3);
      const parent = testCard('parent', { board: 'other' });
      const list = [parent, { ...oldest!, parentWorkItemId: 'parent' }, ...rest];

      const { body } = ask(list, { limit: '1', item: cardId(0) });

      expect(body.related.map(card => card.id)).toEqual(['parent']);
    });

    // A link to an old card used to list its whole phase above it: 82% of a 10,000-card board.
    it.each([2_000, 10_000])('names no more cards for the oldest of %i than for one on the first page', count => {
      const list = aged(count, 'done');
      const shallow = ask(list, { item: cardId(count - 1) });
      const deep = ask(list, { item: cardId(0) });

      expect(deep.body.item?.places).toEqual([{ phase: 'done', position: count - 1 }]);
      expect(shallow.named).toHaveLength(50);
      // The asked card is the one more.
      expect(deep.named).toHaveLength(51);
      expect(deep.body.phases).toEqual(shallow.body.phases);
    });
  });

  it('deepens a phase whose id is as long as a board allows', () => {
    const longest = 'p'.repeat(128);
    const list = [testCard('a', { stages: [longest] }), testCard('b', { stages: [longest] })];

    const { body } = boardPhases(
      list,
      { id: 'work', phases: [longest] },
      view({ limit: '1', window: [`${longest}:2`] }),
      'u1',
      version,
    );

    expect(body.phases[0]?.cards.map(card => card.id)).toEqual(['b', 'a']);
  });

  it('shows a card held by none of the board’s phases under the first one only', () => {
    const { body } = boardPhases([testCard('lost', { stages: ['retired-lane'] })], BOARD, view(), 'u1', version);

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

    const { body, named } = boardPhases([parent, child], BOARD, view({ limit: '1' }), 'u1', version);

    expect(body.related).toEqual([{ id: 'parent', version: 'version of parent' }]);
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
