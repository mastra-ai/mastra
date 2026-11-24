import { describe, expect, it } from 'vitest';

import { rule } from './fixtures/rulesServer';
import { boardFlow } from '../boardFlow';
import type { BoardFlow } from '../boardFlow';

const security = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', value: 'security', operator: 'equals' as const }],
};
const work = { key: 'work', initialPhase: 'intake' };

function to(boardKey: string, phaseKey: string, moveToBoardKey: string | null = null) {
  return { boardKey, phaseKey, joinClosedIssue: false, moveToBoardKey };
}

/** Rule names per phase, and leaving rule names, so a failure reads as which rule went where. */
function names({ into, leaving }: BoardFlow) {
  return {
    into: Object.fromEntries([...into].map(([phase, rules]) => [phase, rules.map(rule => rule.name)])),
    leaving: leaving.map(rule => rule.name),
  };
}

describe('boardFlow', () => {
  it('takes a phase whose key is also an object property name', () => {
    const flow = boardFlow(
      [rule({ name: 'Built', on: ['work_item.closed'], target: to('work', 'constructor') })],
      work,
    );
    expect(names(flow).into).toEqual({ constructor: ['Built'] });
  });

  it('counts each rule under the phase it moves cards into, the first phase when it names none', () => {
    const flow = boardFlow(
      [
        rule({ name: 'New issues', on: ['work_item.opened'] }),
        rule({ name: 'Merged', on: ['pull_request.merged'], target: to('work', 'done') }),
        rule({ name: 'Closed', on: ['work_item.closed'], target: to('work', 'done') }),
      ],
      work,
    );

    expect(names(flow).into).toEqual({ intake: ['New issues'], done: ['Closed', 'Merged'] });
  });

  it('counts a rule once, however many triggers it fires on', () => {
    const flow = boardFlow(
      [rule({ name: 'Finished', on: ['work_item.closed', 'pull_request.merged'], target: to('work', 'done') })],
      work,
    );
    expect(names(flow).into).toEqual({ done: ['Finished'] });
  });

  it('leaves out rules that never move a card: off, broken, or below a rule taking every card', () => {
    const flow = boardFlow(
      [
        rule({ name: 'Every new issue', on: ['work_item.opened'] }),
        rule({ name: 'Below the catch-all', on: ['work_item.opened'], when: security, target: to('work', 'triage') }),
        rule({ name: 'Off', on: ['work_item.closed'], enabled: false, target: to('work', 'done') }),
        rule({ name: 'Broken', on: ['work_item.reopened'], problems: ['Phase gone'], target: to('work', 'done') }),
      ],
      work,
    );

    expect(names(flow).into).toEqual({ intake: ['Every new issue'] });
  });

  it('counts a rule sending cards to another board as leaving here and arriving there', () => {
    const rules = [
      rule({
        name: 'Security labels',
        on: ['work_item.updated'],
        when: security,
        target: to('work', 'backlog', 'security'),
      }),
      rule({ name: 'Security issues', on: ['work_item.opened'], target: to('security', 'backlog') }),
    ];

    expect(names(boardFlow(rules, work))).toEqual({ into: {}, leaving: ['Security labels'] });
    expect(names(boardFlow(rules, { key: 'security', initialPhase: 'backlog' }))).toEqual({
      into: { backlog: ['Security labels', 'Security issues'] },
      leaving: [],
    });
  });
});
