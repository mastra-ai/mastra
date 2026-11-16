import type { PlatformAlertEvent } from '../../rules/types.js';

/**
 * Re-fire handling for Mastra Alerts cards.
 *
 * One card per alert rule (the work key), not per incident: an alert that fires, recovers and fires
 * again lands on the same card. The card's metadata carries the alert state and a short activity
 * timeline, since Factory cards have no comment feed of their own.
 */

export const ALERT_REOPEN_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const ALERT_FLAP_WINDOW_MS = 10 * 60 * 1000;
export const ALERT_TIMELINE_MAX = 50;
const SEEN_EVENT_IDS_MAX = 200;

export type AlertSeverity = PlatformAlertEvent['incident']['severity'];
const SEVERITY_RANK: Record<AlertSeverity, number> = { info: 0, warning: 1, error: 2, critical: 3 };

export function severityAtLeast(severity: AlertSeverity, floor: AlertSeverity): boolean {
  return SEVERITY_RANK[severity] >= SEVERITY_RANK[floor];
}

export type AlertTimelineKind =
  'fired' | 'fired_again' | 'flapping' | 'severity_raised' | 'recovered' | 'reopened' | 'mention';

export interface AlertTimelineEntry {
  at: string;
  kind: AlertTimelineKind;
  text: string;
  incidentId?: string;
  count?: number;
}

export interface AlertSlackThread {
  teamId: string;
  channelId: string;
  ts: string;
}

export interface AlertCardState {
  workKey: string;
  generation: number;
  fireCount: number;
  /** Fires in the current flap episode; 1 outside one. */
  flapCount: number;
  lastFireAt: string;
  severity: AlertSeverity;
  incidents: Record<string, { openedAt: string | null; resolvedAt: string | null; severity: AlertSeverity }>;
  previousCardId?: string;
  slackThread?: AlertSlackThread;
  /** Event ids already applied to this card, so a redelivered event changes nothing. */
  seenEventIds: string[];
}

/** The latest card filed for an alert's work key, as the planner sees it. */
export interface AlertCardView {
  id: string;
  state: AlertCardState;
  timeline: AlertTimelineEntry[];
  terminal: boolean;
  /** When the card entered its terminal phase; null while open. */
  terminalSince: string | null;
}

export type AlertPlan =
  | { kind: 'reject'; code: 'below_severity_floor' | 'org_hourly_cap'; reason: string }
  | { kind: 'noop'; reason: 'replayed' | 'no_card' }
  /** A resolve for an incident no card holds yet; remembered so a late `opened` lands as recovered. */
  | { kind: 'remember_resolve'; incidentId: string; resolvedAt: string }
  | { kind: 'create'; state: AlertCardState; timeline: AlertTimelineEntry[] }
  | {
      kind: 'update';
      state: AlertCardState;
      timeline: AlertTimelineEntry[];
      reopen: boolean;
      /** Set when this event first gives the card its Slack thread. */
      bindThread?: AlertSlackThread;
    };

/** `rule:<id>` or `fp:<fingerprint>`. Per-group alerts would extend this (`rule:<id>:g:<hash>`); not built. */
export function alertWorkKey(workKey: PlatformAlertEvent['workKey']): string {
  return workKey.kind === 'rule' ? `rule:${workKey.ruleId}` : `fp:${workKey.fingerprint}`;
}

export function alertSourceKey(workKey: string, generation: number): string {
  return `${workKey}#${generation}`;
}

/** The generation a source key names for this work key, or null when it belongs to another alert. */
export function alertGeneration(sourceKey: string, workKey: string): number | null {
  const prefix = `${workKey}#`;
  if (!sourceKey.startsWith(prefix)) return null;
  const generation = Number(sourceKey.slice(prefix.length));
  return Number.isInteger(generation) && generation > 0 ? generation : null;
}

export interface PlanAlertEventInput {
  event: PlatformAlertEvent;
  card: AlertCardView | null;
  now: Date;
  severityFloor: AlertSeverity;
  /** When an earlier `resolved` for this event's incident arrived before any card held it. */
  resolvedEarly?: string;
  cooldownMs?: number;
  flapWindowMs?: number;
}

function label(event: PlatformAlertEvent): string {
  return event.rule?.name ?? event.summary;
}

function appendTimeline(timeline: AlertTimelineEntry[], entry: AlertTimelineEntry): AlertTimelineEntry[] {
  return [...timeline, entry].slice(-ALERT_TIMELINE_MAX);
}

function seen(state: AlertCardState, eventId: string): string[] {
  return [...state.seenEventIds, eventId].slice(-SEEN_EVENT_IDS_MAX);
}

/**
 * When the alert fired. The flap window and reopen cooldown use this, not ingest time: a Factory that
 * polls late (down, or behind a burst) must not fold separate fires into one flap.
 */
function firedAt(event: PlatformAlertEvent): number {
  return Date.parse(event.incident.openedAt);
}

function newCard(input: PlanAlertEventInput, generation: number, previousCardId?: string): AlertPlan {
  const { event, now } = input;
  const at = now.toISOString();
  const resolvedAt = input.resolvedEarly ?? event.incident.resolvedAt;
  const state: AlertCardState = {
    workKey: alertWorkKey(event.workKey),
    generation,
    fireCount: 1,
    flapCount: 1,
    lastFireAt: event.incident.openedAt,
    severity: event.incident.severity,
    incidents: {
      [event.incident.id]: { openedAt: event.incident.openedAt, resolvedAt, severity: event.incident.severity },
    },
    ...(previousCardId ? { previousCardId } : {}),
    ...(event.slack ? { slackThread: event.slack } : {}),
    seenEventIds: [event.eventId],
  };
  let timeline = appendTimeline([], {
    at,
    kind: 'fired',
    text: `${label(event)} fired (${event.incident.severity}).`,
    incidentId: event.incident.id,
  });
  if (resolvedAt) {
    timeline = appendTimeline(timeline, {
      at,
      kind: 'recovered',
      text: `${label(event)} recovered.`,
      incidentId: event.incident.id,
    });
  }
  return { kind: 'create', state, timeline };
}

function fire(input: PlanAlertEventInput, card: AlertCardView): AlertPlan {
  const { event, now } = input;
  const at = now.toISOString();
  const flapWindowMs = input.flapWindowMs ?? ALERT_FLAP_WINDOW_MS;
  const known = card.state.incidents[event.incident.id];
  const resolvedAt = known?.resolvedAt ?? input.resolvedEarly ?? event.incident.resolvedAt;
  const reopen = card.terminal;
  const flapping = !reopen && Math.abs(firedAt(event) - Date.parse(card.state.lastFireAt)) <= flapWindowMs;
  const flapCount = flapping ? card.state.flapCount + 1 : 1;
  const bind = threadToBind(card, event);
  const state: AlertCardState = {
    ...card.state,
    ...(bind.bindThread ? { slackThread: bind.bindThread } : {}),
    fireCount: card.state.fireCount + 1,
    flapCount,
    lastFireAt: new Date(Math.max(firedAt(event), Date.parse(card.state.lastFireAt))).toISOString(),
    severity: maxSeverity(card.state.severity, event.incident.severity),
    incidents: {
      ...card.state.incidents,
      [event.incident.id]: { openedAt: event.incident.openedAt, resolvedAt, severity: event.incident.severity },
    },
    seenEventIds: seen(card.state, event.eventId),
  };
  const recoveredNote = resolvedAt ? ' It has already recovered.' : '';
  let timeline: AlertTimelineEntry[];
  if (reopen) {
    timeline = appendTimeline(card.timeline, {
      at,
      kind: 'reopened',
      text: `${label(event)} fired again after this card was closed; reopened.${recoveredNote}`,
      incidentId: event.incident.id,
    });
  } else if (flapping) {
    timeline = upsertFlapping(card.timeline, at, label(event), flapCount, event.incident.id);
  } else {
    timeline = appendTimeline(card.timeline, {
      at,
      kind: 'fired_again',
      text: `${label(event)} fired again (${event.incident.severity}).${recoveredNote}`,
      incidentId: event.incident.id,
    });
  }
  return { kind: 'update', state, timeline, reopen, ...bind };
}

/** Many fires close together collapse into one entry that counts them. */
function upsertFlapping(
  timeline: AlertTimelineEntry[],
  at: string,
  name: string,
  count: number,
  incidentId: string,
  recoveredAt?: string,
): AlertTimelineEntry[] {
  const text = `${name} is flapping: fired ${count}× in a short window${recoveredAt ? `, last recovered ${recoveredAt}` : ''}.`;
  const last = timeline.at(-1);
  if (last?.kind === 'flapping') {
    return [...timeline.slice(0, -1), { ...last, text, count, incidentId, at: recoveredAt ? last.at : at }];
  }
  return appendTimeline(timeline, { at, kind: 'flapping', text, count, incidentId });
}

function maxSeverity(a: AlertSeverity, b: AlertSeverity): AlertSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function threadToBind(card: AlertCardView, event: PlatformAlertEvent): { bindThread?: AlertSlackThread } {
  return event.slack && !card.state.slackThread ? { bindThread: event.slack } : {};
}

function withThread(state: AlertCardState, bind: { bindThread?: AlertSlackThread }): AlertCardState {
  return bind.bindThread ? { ...state, slackThread: bind.bindThread } : state;
}

/**
 * What one alert event does to the alert's latest card. Pure: the caller loads the card and applies
 * the plan. Re-fires never start a run; the project's routes decide what a new or reopened card gets.
 */
export function planAlertEvent(input: PlanAlertEventInput): AlertPlan {
  const { event, card, now } = input;
  if (card?.state.seenEventIds.includes(event.eventId)) return { kind: 'noop', reason: 'replayed' };
  const cooldownMs = input.cooldownMs ?? ALERT_REOPEN_COOLDOWN_MS;
  const at = now.toISOString();

  switch (event.type) {
    case 'alert.opened':
    case 'alert.severity_raised': {
      if (event.type === 'alert.opened' && event.capped) {
        return { kind: 'reject', code: 'org_hourly_cap', reason: 'Organization passed its hourly alert cap.' };
      }
      const known = card?.state.incidents[event.incident.id];
      if (event.type === 'alert.severity_raised' && card && known) {
        const bind = threadToBind(card, event);
        return {
          kind: 'update',
          state: withThread(
            {
              ...card.state,
              severity: maxSeverity(card.state.severity, event.incident.severity),
              incidents: {
                ...card.state.incidents,
                [event.incident.id]: { ...known, severity: event.incident.severity },
              },
              seenEventIds: seen(card.state, event.eventId),
            },
            bind,
          ),
          timeline: appendTimeline(card.timeline, {
            at,
            kind: 'severity_raised',
            text: `${label(event)} escalated to ${event.incident.severity}.`,
            incidentId: event.incident.id,
          }),
          reopen: false,
          ...bind,
        };
      }
      // A raise on an incident Factory never filed counts as its first fire once it passes the floor.
      if (!severityAtLeast(event.incident.severity, input.severityFloor)) {
        return {
          kind: 'reject',
          code: 'below_severity_floor',
          reason: `Severity ${event.incident.severity} is below the ${input.severityFloor} floor.`,
        };
      }
      if (!card) return newCard(input, 1);
      if (known?.openedAt) {
        // The same incident again (a re-sent `opened`): nothing new happened. (a re-sent `opened`): nothing new happened.
        return {
          kind: 'update',
          state: { ...card.state, seenEventIds: seen(card.state, event.eventId) },
          timeline: card.timeline,
          reopen: false,
        };
      }
      if (card.terminal && card.terminalSince && firedAt(event) - Date.parse(card.terminalSince) > cooldownMs) {
        return newCard(input, card.state.generation + 1, card.id);
      }
      return fire(input, card);
    }
    case 'alert.resolved': {
      const resolvedAt = event.incident.resolvedAt ?? event.occurredAt;
      if (!card) return { kind: 'remember_resolve', incidentId: event.incident.id, resolvedAt };
      const known = card.state.incidents[event.incident.id];
      if (!known) {
        // A resolve that overtook its `opened`: remember it on the card; the late `opened` notes it.
        return {
          kind: 'update',
          state: {
            ...card.state,
            incidents: {
              ...card.state.incidents,
              [event.incident.id]: { openedAt: null, resolvedAt, severity: event.incident.severity },
            },
            seenEventIds: seen(card.state, event.eventId),
          },
          timeline: card.timeline,
          reopen: false,
        };
      }
      const state: AlertCardState = {
        ...card.state,
        incidents: { ...card.state.incidents, [event.incident.id]: { ...known, resolvedAt } },
        seenEventIds: seen(card.state, event.eventId),
      };
      const timeline =
        card.state.flapCount > 1 && card.timeline.at(-1)?.kind === 'flapping'
          ? upsertFlapping(card.timeline, at, label(event), card.state.flapCount, event.incident.id, resolvedAt)
          : appendTimeline(card.timeline, {
              at,
              kind: 'recovered',
              text: `${label(event)} recovered.`,
              incidentId: event.incident.id,
            });
      return { kind: 'update', state, timeline, reopen: false };
    }
    case 'alert.thread_linked': {
      if (!card) return { kind: 'noop', reason: 'no_card' };
      const bind = threadToBind(card, event);
      return {
        kind: 'update',
        state: withThread({ ...card.state, seenEventIds: seen(card.state, event.eventId) }, bind),
        timeline: card.timeline,
        reopen: false,
        ...bind,
      };
    }
  }
}
