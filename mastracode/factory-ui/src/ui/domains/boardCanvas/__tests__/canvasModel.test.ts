import { describe, expect, it } from 'vitest';

import type { IntakeRouteInfo, IntakeTestResponse, StoredPhaseInfo } from '../../../../api/types';
import {
  canvasModel,
  emphasisOf,
  intakeSentence,
  orderNote,
  ruleLines,
  ruleNotes,
  sessionSpans,
  triggerFallback,
} from '../canvasModel';
import type { CanvasModel } from '../canvasModel';

let seq = 0;

function route(name: string, fields: Partial<IntakeRouteInfo> = {}): IntakeRouteInfo {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    name,
    enabled: true,
    position: seq,
    when: null,
    target: { boardKey: 'work', phaseKey: null, joinClosedIssue: false, moveToBoardKey: null },
    on: ['work_item.opened'],
    revision: 1,
    createdBy: 'ada',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedBy: 'ada',
    updatedAt: '2026-11-01T00:00:00.000Z',
    problems: [],
    ...fields,
  };
}

function into(phaseKey: string | null, fields: Partial<IntakeRouteInfo['target']> = {}): IntakeRouteInfo['target'] {
  return { boardKey: 'work', phaseKey, joinClosedIssue: false, moveToBoardKey: null, ...fields };
}

function labelled(value: string): IntakeRouteInfo['when'] {
  return { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value }] };
}

function phase(key: string, fields: Partial<StoredPhaseInfo> = {}): StoredPhaseInfo {
  return { key, name: key[0]?.toUpperCase() + key.slice(1), kind: 'resting', nextPhases: [], ...fields };
}

const phases = [
  phase('intake', { nextPhases: ['triage'] }),
  phase('triage'),
  phase('planning'),
  phase('done', { kind: 'terminal' }),
  phase('archive'),
];

const lineNames = (model: CanvasModel) => model.rows.map(row => [row.phase.key, row.lines.map(line => line.label)]);

describe('canvasModel', () => {
  it('puts each rule on the phase it files into, and the first phase when it names none', () => {
    const model = canvasModel({
      boardKey: 'work',
      phases,
      rules: [
        route('Bugs', { when: labelled('bug'), target: into('triage') }),
        route('Docs', { when: labelled('docs') }),
      ],
    });

    expect(lineNames(model)).toEqual([
      ['intake', ['Docs']],
      ['triage', ['Bugs']],
      ['planning', []],
      ['done', []],
      ['archive', []],
    ]);
  });

  it('keeps rules that send cards to another board, and rules into a phase the board lost, out of the phases', () => {
    const model = canvasModel({
      boardKey: 'work',
      phases,
      rules: [
        route('Ship it', { on: ['pull_request.merged'], target: into('queued', { moveToBoardKey: 'release' }) }),
        route('Old triage', { when: labelled('old'), target: into('gone') }),
      ],
    });

    expect(model.leaving.map(line => line.rule.name)).toEqual(['Ship it']);
    expect(model.stray.map(line => line.rule.name)).toEqual(['Old triage']);
    expect(model.rows.flatMap(row => row.lines)).toEqual([]);
  });

  it("shows another board's rule on the phase it moves cards into, or apart when this board lost that phase", () => {
    const model = canvasModel({
      boardKey: 'work',
      phases,
      rules: [
        route('Back to planning', {
          on: ['pull_request.closed'],
          target: into('planning', { boardKey: 'release', moveToBoardKey: 'work' }),
        }),
        route('Back to review', {
          on: ['pull_request.closed'],
          target: into('review', { boardKey: 'release', moveToBoardKey: 'work' }),
        }),
      ],
    });

    expect(model.rows.find(row => row.phase.key === 'planning')?.incoming.map(rule => rule.name)).toEqual([
      'Back to planning',
    ]);
    expect(model.rows.flatMap(row => row.incoming).map(rule => rule.name)).toEqual(['Back to planning']);
    expect(model.strayIncoming.map(rule => rule.name)).toEqual(['Back to review']);
  });

  it('flags a phase that no rule, move or Factory flow brings cards to, but never the first', () => {
    const model = canvasModel({
      boardKey: 'work',
      phases: [phase('intake'), ...phases.slice(1)],
      rules: [route('Plan it', { when: labelled('plan'), target: into('planning') })],
      flow: { completed: 'done' },
    });

    expect(model.rows.filter(row => row.unreached).map(row => row.phase.key)).toEqual(['triage', 'archive']);
  });

  it("flags no phase while the rules haven't loaded", () => {
    const model = canvasModel({ boardKey: 'work', phases, rules: undefined });

    expect(model.rows.some(row => row.unreached)).toBe(false);
  });
});

describe('ruleLines', () => {
  it('numbers rules per trigger and warns about the ones a rule above takes everything from', () => {
    const lines = ruleLines([
      route('Everything', {}),
      route('Bugs', { when: labelled('bug'), target: into('triage') }),
    ]);

    expect(lines.map(line => [line.label, line.rank, line.of, line.hiddenBy])).toEqual([
      ['Every new issue', 1, 2, undefined],
      ['Bugs', 2, 2, 1],
    ]);
    expect(ruleNotes(lines[1])).toContainEqual({
      tone: 'warning',
      text: 'Never reached: rule 1 above matches every new issue.',
    });
  });

  it('lets rules below a switched-off catch-all run', () => {
    const lines = ruleLines([route('Everything', { enabled: false }), route('Bugs', { when: labelled('bug') })]);

    expect(lines.map(line => line.hiddenBy)).toEqual([undefined, undefined]);
    expect(ruleNotes(lines[0])).toContainEqual({ tone: 'muted', text: 'Off, skipped' });
  });

  it('shows a rule on two triggers once per trigger, counting filed items only where it files them', () => {
    const both = route('Bugs', { when: labelled('bug'), on: ['work_item.opened', 'work_item.reopened'] });
    const lines = ruleLines([both], { filed: new Map([[both.id, 12]]) });

    expect(lines.map(line => [line.event, line.filed])).toEqual([
      ['work_item.opened', 12],
      ['work_item.reopened', undefined],
    ]);
  });
});

describe('sessionSpans', () => {
  it('groups working phases that share a session and ends them at the terminal phases', () => {
    const spans = sessionSpans([
      phase('intake'),
      phase('triage', { kind: 'working', runner: { skill: 'factory-triage', context: 'triage' } }),
      phase('planning', { kind: 'working', runner: { skill: 'factory-plan', context: 'work' } }),
      phase('building', { kind: 'working', runner: { skill: 'factory-build', context: 'work' } }),
      phase('waiting'),
      phase('fixing', { kind: 'working', runner: { skill: 'factory-build', context: 'work' } }),
      phase('done', { kind: 'terminal' }),
      phase('canceled', { kind: 'terminal' }),
    ]);

    expect(spans).toEqual([
      { label: 'triage session', from: 1, to: 1 },
      { label: 'work session', from: 2, to: 3 },
      { label: 'same work session', from: 5, to: 5 },
      { label: 'sessions stop', from: 6, to: 7 },
    ]);
  });
});

describe('intakeSentence', () => {
  const order = [
    { boardKey: 'work', name: 'Work' },
    { boardKey: 'docs', name: 'Docs' },
    { boardKey: 'release', name: 'Release' },
  ];

  it('says where the board is asked and where the rest go', () => {
    expect(intakeSentence(order, 'intake-order', 'work')).toBe('Asked 1st; the rest go on to Docs.');
    expect(intakeSentence(order, 'intake-order', 'docs')).toBe('Asked 2nd, after Work; the rest go on to Release.');
    expect(intakeSentence(order, 'intake-order', 'release')).toBe(
      'Asked 3rd, after Work and Docs; the rest end Not routed.',
    );
  });

  it('says when the board is not asked, or the old route list decides', () => {
    expect(intakeSentence(order, 'intake-order', 'triage')).toBe('Not in the intake order: none reach this board.');
    expect(intakeSentence(order, 'route-list', 'work')).toBe(
      'Still filed by the old route list until someone saves an order.',
    );
  });
});

describe('triggerFallback', () => {
  const names: Record<string, string> = { done: 'Done', canceled: 'Canceled' };
  const context = {
    boardKey: 'work',
    order: [
      { boardKey: 'work', name: 'Work' },
      { boardKey: 'release', name: 'Release' },
    ],
    evaluator: 'intake-order' as const,
    phaseName: (key: string | undefined) => (key ? names[key] : undefined),
    flow: { completed: 'done', canceled: 'canceled' },
  };

  it('says nothing when a rule on the trigger takes everything', () => {
    expect(triggerFallback('work_item.opened', { ...context, boardRules: [route('Everything')] })).toBeUndefined();
  });

  it('hands new items no rule takes to the next board', () => {
    const boardRules = [route('Bugs', { when: labelled('bug') })];

    expect(triggerFallback('work_item.opened', { ...context, boardRules })).toBe('Otherwise: Release is asked next');
  });

  it("names Factory's own move for closes and merges no rule handles", () => {
    expect(triggerFallback('work_item.closed', { ...context, boardRules: [] })).toBe(
      'No rule: Done, or Canceled if not planned',
    );
    expect(triggerFallback('pull_request.merged', { ...context, boardRules: [] })).toBe(
      'Otherwise: Factory moves it to Done',
    );
    expect(triggerFallback('work_item.updated', { ...context, boardRules: [] })).toBe(
      'Otherwise, the card stays where it is',
    );
  });
});

/** The line a rule draws, failing the test when it draws none. */
function lineFor<Line extends { rule: IntakeRouteInfo }>(rule: IntakeRouteInfo, lines: readonly Line[]): Line {
  const line = lines.find(candidate => candidate.rule === rule);
  if (!line) throw new Error(`${rule.name ?? rule.id} draws no line`);
  return line;
}

describe('emphasisOf', () => {
  const bugs = route('Bugs', { when: labelled('bug'), target: into('triage') });
  const docs = route('Docs', { when: labelled('docs') });
  const reopened = route('Reopened', { on: ['work_item.reopened'], target: into('planning') });
  const model = canvasModel({ boardKey: 'work', phases, rules: [bugs, docs, reopened] });
  const lineOf = (rule: IntakeRouteInfo) =>
    lineFor(
      rule,
      model.rows.flatMap(row => row.lines),
    );

  it('rings the selected rule, keeps its trigger in view and fades the rest', () => {
    const emphasis = emphasisOf(model, phases, { rule: bugs.id });

    expect([bugs, docs, reopened].map(rule => emphasis.line(lineOf(rule)))).toEqual(['selected', undefined, 'dimmed']);
    expect(phases.map(entry => emphasis.node(entry.key))).toEqual(['dimmed', undefined, 'dimmed', 'dimmed', 'dimmed']);
  });

  it('rings the selected phase and keeps its rules and the phases it moves cards to in view', () => {
    const emphasis = emphasisOf(model, phases, { phase: 'intake' });

    expect(emphasis.line(lineOf(docs), 'intake')).toBeUndefined();
    expect(emphasis.line(lineOf(bugs), 'triage')).toBe('dimmed');
    expect(phases.map(entry => emphasis.node(entry.key))).toEqual([
      'selected',
      undefined,
      'dimmed',
      'dimmed',
      'dimmed',
    ]);
  });

  it("lights every rule on a pointed-at trigger and the phases they file into, keeping the panel's phase ringed", () => {
    const emphasis = emphasisOf(model, phases, { lane: 'work_item.opened', phase: 'planning' });

    expect([bugs, docs, reopened].map(rule => emphasis.line(lineOf(rule)))).toEqual([undefined, undefined, 'dimmed']);
    expect(phases.map(entry => emphasis.node(entry.key))).toEqual([
      undefined,
      undefined,
      'selected',
      'dimmed',
      'dimmed',
    ]);
  });

  it("rings the rules that matched a tested item and points out the one another board's rule beat", () => {
    const result: IntakeTestResponse = {
      item: { title: 'Crash on save', url: 'https://github.com/acme/app/issues/7', kind: 'card', id: 'item-7' },
      placement: { boardKey: 'work', routeId: bugs.id, phase: 'triage' },
      reason: null,
      note: null,
      evaluator: 'intake-order',
      boards: [
        {
          boardKey: 'work',
          name: 'Work',
          rules: [
            { routeId: bugs.id, name: 'Bugs', phase: 'triage', outcome: 'took' },
            {
              routeId: docs.id,
              name: 'Docs',
              phase: 'intake',
              outcome: 'lost',
              to: { boardKey: 'release', routeId: 'other' },
            },
          ],
        },
      ],
      current: { boardKey: 'work', phase: 'triage', routeId: bugs.id },
      moves: [
        {
          decisionId: null,
          at: null,
          event: { type: 'work_item.reopened' },
          outcome: 'moves',
          to: { boardKey: 'work', phase: 'planning', routeId: reopened.id },
          phase: null,
          reason: null,
          rules: [{ routeId: reopened.id, name: 'Reopened', outcome: 'took' }],
        },
      ],
    };
    const emphasis = emphasisOf(model, phases, { test: { boardKey: 'work', result } });

    expect([bugs, docs, reopened].map(rule => emphasis.line(lineOf(rule)))).toEqual([
      'selected',
      'elsewhere',
      'selected',
    ]);
    expect(phases.map(entry => emphasis.node(entry.key))).toEqual([
      undefined,
      undefined,
      undefined,
      'dimmed',
      'dimmed',
    ]);
  });
});

describe('orderNote', () => {
  const wontfix = route('Wontfix', { on: ['work_item.closed'], when: labelled('wontfix'), target: into('archive') });
  const closed = route('Closed', { on: ['work_item.closed'], target: into('done') });
  const reopened = route('Reopened', { on: ['work_item.reopened'] });
  const lines = ruleLines([wontfix, closed, reopened]);
  const lineOf = (rule: IntakeRouteInfo) => lineFor(rule, lines);
  const landing = (line: (typeof lines)[number]) => line.rule.target.phaseKey ?? 'intake';

  it('names the rules a rule is checked after on its trigger, or before for the first', () => {
    expect(orderNote(lineOf(wontfix), lines, landing)).toBe('Checked 1st on Issue closed, before “Every card” → done.');
    expect(orderNote(lineOf(closed), lines, landing)).toBe('Checked 2nd on Issue closed, after “Wontfix” → archive.');
    expect(orderNote(lineOf(reopened), lines, landing)).toBeUndefined();
  });
});
