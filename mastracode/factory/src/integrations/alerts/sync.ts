import type { PlatformAlertEvent } from '../../rules/types.js';
import { bindingTakesIssue, normalizeIntakeLabel } from '../../storage/domains/intake/base.js';
import type { IntakeSourceBinding } from '../../storage/domains/intake/base.js';
import type { IssueReconcileSummary } from '../issue-reconciler.js';

import { alertLabels } from './default-rules.js';
import type { AlertCardRef, PlatformAlertIngestResult, PlatformAlertRulesIngress } from './rules.js';

export interface AlertEventPage {
  events: Array<PlatformAlertEvent & { streamId: string }>;
  nextCursor: string | null;
}

export interface AlertAck {
  incidentId: string;
  workItemId: string;
  workItemUrl: string;
  slackReply: 'factory' | 'platform';
}

/** Where one bound project is in the org's alert event log. */
export interface AlertProjectCursor {
  /** Stream id of the last event this project settled; null starts at the oldest retained event. */
  after: string | null;
  /**
   * Set on the first pass after the project was bound: events up to `until` are only applied for
   * `incidents`, the incidents still open when it was bound, so old fires do not file cards.
   */
  backfill?: { until: string; incidents: string[] };
}

/** Cursor state for the one Platform org this Factory's credential reads, per bound project. */
export interface AlertSyncCursor {
  projects?: Record<string, AlertProjectCursor>;
}

export type AlertBinding = Pick<IntakeSourceBinding, 'factoryProjectId' | 'labels' | 'createdAt'>;

export interface AlertSyncDeps {
  /** The Platform org this Factory is connected to, or null when it is not. */
  organizationId: () => Promise<string | null>;
  listEvents: (afterEventId: string | undefined) => Promise<AlertEventPage>;
  ack: (ack: AlertAck) => Promise<void>;
  loadCursor: () => Promise<AlertSyncCursor>;
  saveCursor: (cursor: AlertSyncCursor) => Promise<void>;
  listProjects: () => Promise<ReadonlyArray<{ id: string; orgId: string }>>;
  intakeEnabled: (orgId: string) => Promise<boolean>;
  /** Projects of `orgId` that take Mastra Alerts, with the labels each takes. */
  bindings: (orgId: string) => Promise<AlertBinding[]>;
  ingest: (input: PlatformAlertRulesIngress) => Promise<PlatformAlertIngestResult>;
  /** The card's web address; undefined when this Factory has none, which skips the ack. */
  workItemUrl: (input: { factoryProjectId: string } & AlertCardRef) => string | undefined;
  /**
   * Whether the Factory's own Slack app can post in an alert's thread. False sends the ack as
   * `platform`, so the Alerts app posts the work-item link instead.
   */
  canReplyInThread?: (thread: { teamId: string; channelId: string }) => Promise<boolean>;
  /** A card create the dispatcher hasn't filed holds the cursor; past this many ticks, move on. */
  maxPendingTicks?: number;
  userId?: string;
  logger?: { warn: (msg: string, meta?: Record<string, unknown>) => void };
}

const DEFAULT_MAX_PENDING_TICKS = 30;
const SEVERITIES = ['info', 'warning', 'error', 'critical'] as const;

/** Order of two Redis stream ids (`<ms>-<seq>`). */
export function compareStreamIds(left: string, right: string): number {
  const [leftMs = 0, leftSeq = 0] = left.split('-').map(Number);
  const [rightMs = 0, rightSeq = 0] = right.split('-').map(Number);
  return leftMs - rightMs || leftSeq - rightSeq;
}

/** Labels an alert event is routed by: the card's labels plus the Platform project it fired in. */
export function alertRoutingLabels(event: PlatformAlertEvent): string[] {
  return [...alertLabels(event), ...(event.projectId ? [`platform-project:${event.projectId}`] : [])];
}

/**
 * Tails the Platform alert event log for the org this Factory's credential belongs to and applies
 * each event to the Factory projects bound to Mastra Alerts, each at its own cursor. A first fire
 * goes to the projects whose binding labels take it (as a labeled issue would); later events of an
 * incident go to every bound project, and land only where its card is.
 *
 * Delivery is at-least-once: a project's cursor advances past an event only once it committed, and
 * each commit is idempotent on the event id. A first fire commits a create that the dispatcher
 * files a moment later; until then that project's cursor holds on it so the rule's later events land
 * on the card, not beside it.
 */
export function createAlertSync(deps: AlertSyncDeps): () => Promise<IssueReconcileSummary> {
  const pendingTicks = new Map<string, number>();
  const maxPending = deps.maxPendingTicks ?? DEFAULT_MAX_PENDING_TICKS;
  const userId = deps.userId ?? 'factory-rule-dispatcher';

  const readAll = async (): Promise<AlertEventPage['events']> => {
    const events: AlertEventPage['events'] = [];
    let after: string | undefined;
    for (;;) {
      const page = await deps.listEvents(after);
      events.push(...page.events);
      after = page.events.at(-1)?.streamId;
      if (!page.nextCursor || !after) return events;
    }
  };

  /** The cursor of a project bound since the last pass: open incidents only, up to the log's end. */
  const startCursor = async (): Promise<AlertProjectCursor> => {
    const events = await readAll();
    const until = events.at(-1)?.streamId;
    if (!until) return { after: null };
    const resolved = new Set(events.filter(e => e.type === 'alert.resolved').map(e => e.incident.id));
    const open = events.filter(e => e.type === 'alert.opened' && !resolved.has(e.incident.id));
    return { after: null, backfill: { until, incidents: [...new Set(open.map(e => e.incident.id))] } };
  };

  return async () => {
    const summary: IssueReconcileSummary = {
      projects: 0,
      checked: 0,
      updated: 0,
      closed: 0,
      missing: 0,
      failed: 0,
      errors: [],
    };
    const orgId = await deps.organizationId();
    if (!orgId) return summary;
    const owned = new Set((await deps.listProjects()).filter(p => p.orgId === orgId).map(p => p.id));
    const bindings =
      owned.size > 0 && (await deps.intakeEnabled(orgId))
        ? (await deps.bindings(orgId)).filter(binding => owned.has(binding.factoryProjectId))
        : [];
    const cursor = await deps.loadCursor();
    const projects: Record<string, AlertProjectCursor> = {};
    // An unbound project drops its place; binding it again starts from the open incidents.
    for (const binding of bindings) {
      const known = cursor.projects?.[binding.factoryProjectId];
      if (known) projects[binding.factoryProjectId] = known;
    }
    const save = () => deps.saveCursor({ projects });
    if (Object.keys(cursor.projects ?? {}).some(id => !projects[id])) await save();
    summary.projects = bindings.length;

    for (const binding of bindings) {
      const factoryProjectId = binding.factoryProjectId;
      let place = projects[factoryProjectId];
      if (!place) {
        place = await startCursor();
        projects[factoryProjectId] = place;
        await save();
      }
      const project = place;
      const takes = (event: PlatformAlertEvent) => bindingTakesIssue(binding, bindings, alertRoutingLabels(event));
      const ingestFor = (event: AlertEventPage['events'][number]): boolean => {
        const backfill = project.backfill;
        if (backfill && compareStreamIds(event.streamId, backfill.until) <= 0) {
          if (!backfill.incidents.includes(event.incident.id)) return false;
        }
        if (event.type !== 'alert.opened') return true;
        return takes(event);
      };

      projectPass: for (;;) {
        const page = await deps.listEvents(project.after ?? undefined);
        if (page.events.length === 0) break;
        for (const entry of page.events) {
          const { streamId, ...event } = entry;
          // A create the dispatcher hasn't filed holds up to the pending limit; a failed ingest or
          // ack holds until it succeeds, since moving past it would lose the card or its ack.
          let held = false;
          let failed = false;
          if (ingestFor(entry)) {
            summary.checked++;
            try {
              const result = await deps.ingest({
                orgId,
                userId,
                factoryProjectId,
                event,
                ...(namesSeverity(binding, event) ? { severityFloor: 'info' as const } : {}),
                // A raise reaches every bound project so the card's owner sees it, but files a card
                // only where the binding takes it.
                ...(event.type === 'alert.severity_raised' && !takes(event) ? { createCards: false } : {}),
              });
              const card = cardOf(result);
              if (result.status === 'pending') held = true;
              else if (result.status === 'missing') summary.missing++;
              else if (result.status === 'committed') summary.updated++;
              const workItemUrl = card && deps.workItemUrl({ factoryProjectId, ...card });
              if (card && workItemUrl) {
                await deps.ack({
                  incidentId: event.incident.id,
                  workItemId: card.workItemId,
                  workItemUrl,
                  slackReply: await slackReplyFor(deps, event),
                });
              }
            } catch (error) {
              summary.failed++;
              summary.errors.push({
                projectId: factoryProjectId,
                error: error instanceof Error ? error.message : String(error),
              });
              failed = true;
            }
          }
          if (failed) break projectPass;
          const pendingKey = `${factoryProjectId}:${event.eventId}`;
          if (held) {
            const ticks = (pendingTicks.get(pendingKey) ?? 0) + 1;
            pendingTicks.set(pendingKey, ticks);
            if (ticks < maxPending) break projectPass;
            deps.logger?.warn('Mastra Alerts event still unfiled; moving past it', {
              factoryProjectId,
              eventId: event.eventId,
              ticks,
            });
          }
          pendingTicks.delete(pendingKey);
          project.after = streamId;
          if (project.backfill && compareStreamIds(streamId, project.backfill.until) >= 0) delete project.backfill;
          await save();
        }
        if (!page.nextCursor) break;
      }
    }
    return summary;
  };
}

/**
 * Whether the binding asks for this alert's severity by label (`severity:warning`), which takes it
 * even below the default severity floor.
 */
function namesSeverity(binding: AlertBinding, event: PlatformAlertEvent): boolean {
  if (!SEVERITIES.includes(event.incident.severity)) return false;
  const wanted = normalizeIntakeLabel(`severity:${event.incident.severity}`);
  return (binding.labels ?? []).some(label => normalizeIntakeLabel(label) === wanted);
}

function cardOf(result: PlatformAlertIngestResult): AlertCardRef | undefined {
  if (result.status === 'committed') return { workItemId: result.workItemId, board: result.board };
  if (result.status === 'replayed') return result.card;
  return undefined;
}

async function slackReplyFor(deps: AlertSyncDeps, event: PlatformAlertEvent): Promise<'factory' | 'platform'> {
  if (!deps.canReplyInThread) return 'platform';
  // Without a thread yet the Factory claims the reply; a later thread_linked can still flip it.
  if (!event.slack) return 'factory';
  return (await deps.canReplyInThread(event.slack)) ? 'factory' : 'platform';
}
