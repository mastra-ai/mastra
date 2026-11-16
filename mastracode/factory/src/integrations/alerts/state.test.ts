import { describe, expect, it } from 'vitest';
import type { PlatformAlertEvent } from '../../rules/types.js';
import { alertGeneration, alertSourceKey, alertWorkKey, planAlertEvent } from './state.js';
import type { AlertCardView, AlertPlan, PlanAlertEventInput } from './state.js';

const T0 = new Date('2026-11-13T10:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function event(
  type: PlatformAlertEvent['type'],
  incidentId: string,
  overrides: Partial<PlatformAlertEvent> & { severity?: PlatformAlertEvent['incident']['severity'] } = {},
): PlatformAlertEvent {
  const { severity = 'error', ...rest } = overrides;
  const suffix =
    type === 'alert.opened'
      ? 'opened'
      : type === 'alert.resolved'
        ? 'resolved'
        : type === 'alert.severity_raised'
          ? `sev:${severity}`
          : 'thread';
  return {
    eventId: `${incidentId}:${suffix}`,
    type,
    occurredAt: T0.toISOString(),
    organizationId: 'org-1',
    incident: {
      id: incidentId,
      fingerprint: 'fp',
      eventType: 'observability.rule',
      severity,
      openedAt: T0.toISOString(),
      resolvedAt: type === 'alert.resolved' ? T0.toISOString() : null,
      eventCount: 1,
    },
    workKey: { kind: 'rule', ruleId: 'rule-1' },
    projectId: 'proj-1',
    region: 'us',
    rule: { id: 'rule-1', name: 'Error rate', conditionSummary: 'errors > 5%', windowSeconds: 300, url: '' },
    summary: 'Error rate above 5%',
    ...rest,
  };
}

type Step = { event: PlatformAlertEvent; now: Date; firedAt?: Date } | { close: Date } | { closeReopen: true };

/**
 * Applies plans the way the rules do: a create or update replaces the card's state. An opened
 * incident opens when its step runs (`now`) unless `firedAt` says it fired earlier and was polled late.
 */
function run(steps: Step[]) {
  let card: AlertCardView | null = null;
  const plans: AlertPlan[] = [];
  const created: string[] = [];
  let early: Record<string, string> = {};
  for (const step of steps) {
    if ('close' in step) {
      if (card) card = { ...card, terminal: true, terminalSince: step.close.toISOString() };
      continue;
    }
    if ('closeReopen' in step) continue;
    const firedAt = (step.firedAt ?? step.now).toISOString();
    const stepEvent =
      step.event.type === 'alert.opened'
        ? { ...step.event, incident: { ...step.event.incident, openedAt: firedAt } }
        : step.event;
    const input: PlanAlertEventInput = {
      event: stepEvent,
      card,
      now: step.now,
      severityFloor: 'error',
      ...(early[step.event.incident.id] ? { resolvedEarly: early[step.event.incident.id] } : {}),
    };
    const plan = planAlertEvent(input);
    plans.push(plan);
    if (plan.kind === 'create') {
      const id = `card-${plan.state.generation}`;
      created.push(id);
      card = { id, state: plan.state, timeline: plan.timeline, terminal: false, terminalSince: null };
    } else if (plan.kind === 'update' && card) {
      card = {
        ...card,
        state: plan.state,
        timeline: plan.timeline,
        ...(plan.reopen ? { terminal: false, terminalSince: null } : {}),
      };
    } else if (plan.kind === 'remember_resolve') {
      early = { ...early, [plan.incidentId]: plan.resolvedAt };
    }
  }
  return { card, plans, created };
}

describe('alert work keys', () => {
  it('keys on the rule, with a generation suffix', () => {
    const key = alertWorkKey({ kind: 'rule', ruleId: 'r1' });
    expect(key).toBe('rule:r1');
    expect(alertGeneration(alertSourceKey(key, 3), key)).toBe(3);
    expect(alertGeneration('rule:r10#1', key)).toBeNull();
  });
});

describe('planAlertEvent', () => {
  it('files a card on the first fire at or above the floor', () => {
    const { plans, card } = run([{ event: event('alert.opened', 'i1'), now: T0 }]);
    expect(plans[0]?.kind).toBe('create');
    expect(card?.state).toMatchObject({ generation: 1, fireCount: 1, severity: 'error' });
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired']);
  });

  it('rejects a fire below the floor, and files it once it is raised past the floor', () => {
    const { plans, created } = run([
      { event: event('alert.opened', 'i1', { severity: 'warning' }), now: T0 },
      { event: event('alert.severity_raised', 'i1', { severity: 'error' }), now: at(MIN) },
    ]);
    expect(plans[0]).toMatchObject({ kind: 'reject', code: 'below_severity_floor' });
    expect(plans[1]?.kind).toBe('create');
    expect(created).toEqual(['card-1']);
  });

  it('rejects an opened event past the org hourly cap', () => {
    const { plans } = run([{ event: event('alert.opened', 'i1', { capped: true }), now: T0 }]);
    expect(plans[0]).toMatchObject({ kind: 'reject', code: 'org_hourly_cap' });
  });

  it('notes a recovery and leaves the card open', () => {
    const { card, plans } = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { event: event('alert.resolved', 'i1'), now: at(MIN) },
    ]);
    expect(plans[1]).toMatchObject({ kind: 'update', reopen: false });
    expect(card?.terminal).toBe(false);
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered']);
    expect(card?.state.incidents.i1?.resolvedAt).not.toBeNull();
  });

  it('lands a re-fire on the open card as "fired again"', () => {
    const { card, created } = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { event: event('alert.resolved', 'i1'), now: at(MIN) },
      { event: event('alert.opened', 'i2'), now: at(30 * MIN) },
    ]);
    expect(created).toEqual(['card-1']);
    expect(card?.state.fireCount).toBe(2);
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered', 'fired_again']);
  });

  it('collapses ten fires inside the flap window into one counted entry', () => {
    const steps = [];
    for (let i = 0; i < 10; i++) {
      steps.push({ event: event('alert.opened', `i${i}`), now: at(i * MIN) });
      steps.push({ event: event('alert.resolved', `i${i}`), now: at(i * MIN + 30_000) });
    }
    const { card, created } = run(steps);
    expect(created).toEqual(['card-1']);
    expect(card?.state.fireCount).toBe(10);
    const flapping = card?.timeline.filter(entry => entry.kind === 'flapping') ?? [];
    expect(flapping).toHaveLength(1);
    expect(flapping[0]?.count).toBe(10);
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered', 'flapping']);
  });

  it('times the flap window by when each alert fired, not when the Factory polled it', () => {
    // The Factory was down for an hour; two fires 30 minutes apart arrive in the same poll.
    const { card } = run([
      { event: event('alert.opened', 'i1'), now: at(60 * MIN), firedAt: T0 },
      { event: event('alert.resolved', 'i1'), now: at(60 * MIN) },
      { event: event('alert.opened', 'i2'), now: at(60 * MIN), firedAt: at(30 * MIN) },
    ]);
    expect(card?.state.lastFireAt).toBe(at(30 * MIN).toISOString());
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered', 'fired_again']);
  });

  it('times the reopen cooldown by when the alert fired, not when the Factory polled it', () => {
    // Closed on day 1; fired on day 7 (inside the cooldown) but polled on day 9.
    const late = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { close: at(DAY) },
      { event: event('alert.opened', 'i2'), now: at(9 * DAY), firedAt: at(7 * DAY) },
    ]);
    expect(late.created).toEqual(['card-1']);
    expect(late.card?.timeline.at(-1)?.kind).toBe('reopened');
  });

  it('reopens a closed card within the cooldown, and files a linked card after it', () => {
    const reopened = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { close: at(DAY) },
      { event: event('alert.opened', 'i2'), now: at(3 * DAY) },
    ]);
    expect(reopened.plans[1]).toMatchObject({ kind: 'update', reopen: true });
    expect(reopened.created).toEqual(['card-1']);
    expect(reopened.card?.timeline.at(-1)?.kind).toBe('reopened');

    const fresh = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { close: at(DAY) },
      { event: event('alert.opened', 'i2'), now: at(9 * DAY) },
    ]);
    expect(fresh.created).toEqual(['card-1', 'card-2']);
    expect(fresh.card?.state).toMatchObject({ generation: 2, previousCardId: 'card-1' });
  });

  it('applies a redelivered event once', () => {
    const { plans, card } = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { event: event('alert.resolved', 'i1'), now: at(MIN) },
      { event: event('alert.resolved', 'i1'), now: at(2 * MIN) },
      { event: event('alert.opened', 'i1'), now: at(3 * MIN) },
    ]);
    expect(plans.slice(2).map(plan => plan.kind)).toEqual(['noop', 'noop']);
    expect(card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered']);
  });

  it('ends recovered when the resolve overtakes its opened', () => {
    const first = run([
      { event: event('alert.resolved', 'i1'), now: T0 },
      { event: event('alert.opened', 'i1'), now: at(MIN) },
    ]);
    expect(first.plans[0]?.kind).toBe('remember_resolve');
    expect(first.card?.state.incidents.i1?.resolvedAt).not.toBeNull();
    expect(first.card?.timeline.map(entry => entry.kind)).toEqual(['fired', 'recovered']);

    const refire = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { event: event('alert.resolved', 'i2'), now: at(30 * MIN) },
      { event: event('alert.opened', 'i2'), now: at(31 * MIN) },
    ]);
    expect(refire.card?.state.incidents.i2?.resolvedAt).not.toBeNull();
    expect(refire.card?.timeline.at(-1)?.text).toContain('already recovered');
  });

  it('binds the Slack thread once, from opened or a later thread_linked', () => {
    const slack = { teamId: 'T1', channelId: 'C1', ts: '1.2' };
    const inline = run([{ event: event('alert.opened', 'i1', { slack }), now: T0 }]);
    expect(inline.card?.state.slackThread).toEqual(slack);

    const later = run([
      { event: event('alert.opened', 'i1'), now: T0 },
      { event: event('alert.thread_linked', 'i1', { slack }), now: at(MIN) },
      { event: { ...event('alert.thread_linked', 'i1', { slack }), eventId: 'i1:thread:again' }, now: at(2 * MIN) },
    ]);
    expect(later.plans[1]).toMatchObject({ kind: 'update', bindThread: slack });
    expect(later.plans[2]).not.toHaveProperty('bindThread');
    expect(later.card?.state.slackThread).toEqual(slack);
  });
});
