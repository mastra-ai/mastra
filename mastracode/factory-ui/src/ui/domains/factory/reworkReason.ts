import { isHumanActorId } from '@mastra/factory/storage/domains/audit/actors';
import type { AuditActorType } from '@mastra/factory/storage/domains/audit/actors';

import type { InstalledPhaseInfo } from '../../../api/types';
import type { AuditEvent } from './services/audit';
import type { WorkItem } from './services/workItems';

const STAGE_MOVED_ACTION = 'factory.work_item.stage_moved';
/** Where a self-review that asked for changes sends the card: back to Building, or parked in Intake. */
/** Actor id prefix of a session agent moving the card through Factory's tools, not the bound transition tool. */
const SESSION_AGENT_PREFIX = 'agent:session:';
const SELF_REVIEW_RETURN_STAGES = new Set(['execute', 'intake']);

export type ReworkPhase = Pick<InstalledPhaseInfo, 'id' | 'title' | 'name' | 'kind'>;

export interface ReworkReason {
  fromPhase: string;
  fromLabel: string;
  /** Self-review findings or the agent's rationale. People and rules leave none: their causes are machine codes. */
  reason?: string;
  movedBy: AuditActorType;
}

/**
 * Why the card's latest move sent it back to an earlier phase, or undefined
 * when that move went forward. Reads the latest `stage_moved` audit event for
 * the card; when the recent page holds none ending at the card's stage, the
 * card's own stage history.
 */
export function reworkReason(
  item: Pick<WorkItem, 'id' | 'stages' | 'stageHistory' | 'metadata'>,
  phases: readonly ReworkPhase[],
  events: readonly AuditEvent[] | undefined,
): ReworkReason | undefined {
  const current = item.stages[0];
  if (current === undefined) return undefined;

  const latestMove = latestStageMove(item.id, events);
  // Audit writes are best-effort, so an in-page move that doesn't end where the
  // card is now means the latest move went unrecorded: read the stage history.
  const move =
    latestMove && stringField(latestMove.metadata, 'to') === current
      ? {
          from: stringField(latestMove.metadata, 'from'),
          to: current,
          movedBy: latestMove.actorType,
          cause: agentRationale(latestMove),
        }
      : historyMove(item, current);
  if (!move?.from || move.to !== current) return undefined;

  const order = new Map(phases.filter(phase => phase.kind !== 'terminal').map((phase, index) => [phase.id, index]));
  const fromIndex = order.get(move.from);
  const toIndex = order.get(current);
  if (fromIndex === undefined || toIndex === undefined || toIndex >= fromIndex) return undefined;

  const fromPhase = phases.find(phase => phase.id === move.from);
  // Self-review moves the card as the agent; a person moving it back later
  // must not inherit the findings still stored on the card.
  const findings = move.movedBy === 'agent' ? selfReviewFindings(item.metadata, move.from, current) : undefined;
  const reason = findings ?? (move.cause || undefined);
  return {
    fromPhase: move.from,
    fromLabel: fromPhase?.name ?? fromPhase?.title ?? move.from,
    ...(reason ? { reason } : {}),
    movedBy: move.movedBy,
  };
}

/** The first line of a reason that is not a heading, without Markdown markers, for the card face. */
export function reasonSummary(reason: string): string {
  const lines = reason.split('\n').filter(text => text.trim().length > 0);
  const line = lines.find(text => !text.trimStart().startsWith('#')) ?? lines[0] ?? '';
  return line.replace(/^[\s#>*-]+/, '').trim();
}

/**
 * The agent's own words for a move. A bound agent's transition tool records its
 * rationale; a session agent moving through Factory's tools records the code
 * `factory_tools`, which is no reason.
 */
function agentRationale(event: AuditEvent): string | undefined {
  if (event.actorType !== 'agent' || event.actorId.startsWith(SESSION_AGENT_PREFIX)) return undefined;
  return stringField(event.metadata, 'cause')?.trim();
}

function latestStageMove(itemId: string, events: readonly AuditEvent[] | undefined): AuditEvent | undefined {
  let latest: AuditEvent | undefined;
  for (const event of events ?? []) {
    if (event.action !== STAGE_MOVED_ACTION) continue;
    if (!event.targets.some(target => target.type === 'work_item' && target.id === itemId)) continue;
    if (!latest || event.occurredAt > latest.occurredAt) latest = event;
  }
  return latest;
}

function historyMove(item: Pick<WorkItem, 'stageHistory'>, current: string) {
  const entered = item.stageHistory.findLastIndex(entry => entry.stage === current);
  const previous = entered > 0 ? item.stageHistory[entered - 1] : undefined;
  if (!previous) return undefined;
  const by: string = item.stageHistory[entered].by;
  const movedBy: AuditActorType = by.startsWith('agent:') ? 'agent' : isHumanActorId(by) ? 'human' : 'system';
  return { from: previous.stage, to: current, movedBy, cause: undefined };
}

function selfReviewFindings(metadata: Record<string, unknown>, from: string, current: string): string | undefined {
  if (metadata.selfReviewVerdict !== 'request changes') return undefined;
  if (from !== 'review' || !SELF_REVIEW_RETURN_STAGES.has(current)) return undefined;
  return stringField(metadata, 'selfReviewFindings')?.trim() || undefined;
}

function stringField(metadata: Record<string, unknown>, key: string): string | undefined {
  const value = metadata[key];
  return typeof value === 'string' ? value : undefined;
}
