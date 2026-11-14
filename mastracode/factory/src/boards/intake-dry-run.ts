/**
 * The intake dry run: today's rules, or edits not saved yet, run over the project's recent items
 * from their stored facts. Nothing is fetched and nothing is written. Each item is decided by
 * {@link traceIntakeOrder}, the evaluator filing uses, so the dry run shows what filing would do.
 */

import type { RuleFacts } from '../rules/rule-group.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { StoredIntakeDecisionRecord, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { arrivalRuleFacts, INTAKE_ORDER_SAMPLE, traceIntakeOrder } from './intake-routing.js';
import type { IntakeTrace } from './intake-routing.js';
import type { BoardRegistry } from './registry.js';

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'target' | 'on'> &
  Partial<Pick<StoredIntakeRouteRecord, 'name'>>;

/** One recent item the dry run decides: a card from outside, or an item no board took. */
export interface IntakeSampleItem {
  /** The item's source key, unique among the sample. */
  key: string;
  /** The card's id, or the Not routed decision's. */
  id: string;
  kind: 'card' | 'not_routed';
  title: string;
  url: string | null;
  /** When it arrived. */
  at: Date;
  facts: RuleFacts;
}

/**
 * The project's newest {@link INTAKE_ORDER_SAMPLE} items from outside: cards filed from a source,
 * and items no board took. Cards read as stored, so a pull request card lacks the closed-issue facts
 * it was filed with; a Not routed item keeps its whole arrival and reads them as Route again does.
 */
export async function intakeSample(context: {
  cards: readonly Card[];
  notRouted: readonly StoredIntakeDecisionRecord[];
  factoryProjectId: string;
  registry: BoardRegistry;
  card(id: string): Promise<Card | null>;
}): Promise<IntakeSampleItem[]> {
  const items: IntakeSampleItem[] = [];
  for (const card of context.cards) {
    if (!card.externalSource) continue;
    items.push({
      key: card.externalSource.externalId,
      id: card.id,
      kind: 'card',
      title: card.title,
      url: card.externalSource.url ?? null,
      at: card.createdAt,
      facts: cardRuleFacts(card),
    });
  }
  for (const decision of context.notRouted) {
    if (!decision.arrival || !decision.sourceKey) continue;
    items.push({
      key: decision.sourceKey,
      id: decision.id,
      kind: 'not_routed',
      title: decision.title,
      url: decision.url,
      at: decision.decidedAt,
      facts: await arrivalRuleFacts(decision.arrival as unknown as LinkedDecision, context),
    });
  }
  items.sort((left, right) => right.at.getTime() - left.at.getTime());
  const seen = new Set<string>();
  return items
    .filter(item => {
      if (seen.has(item.key)) return false;
      seen.add(item.key);
      return true;
    })
    .slice(0, INTAKE_ORDER_SAMPLE);
}

type LinkedDecision = Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>;

export interface IntakeDryRunPlacement {
  boardKey: string;
  routeId: string;
  phase: string;
}

export interface IntakeDryRunItem {
  key: string;
  id: string;
  kind: IntakeSampleItem['kind'];
  title: string;
  url: string | null;
  /** Where it would land; null when no board takes it. */
  placement: IntakeDryRunPlacement | null;
  /** Every rule that matched and could take it, in the order intake asked them; the first won. */
  matched: { boardKey: string; routeId: string }[];
  /** With a baseline: where today's saved rules and order put it. */
  before?: IntakeDryRunPlacement | null;
}

export interface IntakeDryRunRule {
  routeId: string;
  name: string | null;
  enabled: boolean;
  /** Keys of the items it would take. */
  takes: string[];
  /** Items it matched but an earlier rule took, by the board that took them. */
  lost: { boardKey: string; keys: string[] }[];
  /** Cards it actually filed in the last 30 days, from the decision log; set when asked for. */
  filed?: number;
}

export interface IntakeDryRunBoard {
  boardKey: string;
  name: string;
  /** Keys of the items the board would take. */
  takes: string[];
  /** Items one of its rules matched that another board took first, by that board. */
  lostTo: { boardKey: string; keys: string[] }[];
  rules: IntakeDryRunRule[];
}

export interface IntakeDryRunResult {
  /** How many recent items were decided. */
  sampled: number;
  boards: IntakeDryRunBoard[];
  /** Keys of the items no board would take. */
  notRouted: string[];
  /** With a baseline: how many items land somewhere other than today's rules put them. */
  changed?: number;
  items: IntakeDryRunItem[];
}

export interface IntakeDryRunQuery {
  routes: readonly IntakeRoute[];
  order: readonly string[];
  registry: BoardRegistry;
  items: readonly IntakeSampleItem[];
  /** Today's saved rules and order, to report what the edit changes. */
  baseline?: { routes: readonly IntakeRoute[]; order: readonly string[] };
  /** Cards each rule filed in the last 30 days. */
  filed?: Record<string, number>;
}

function placementOf(trace: IntakeTrace): IntakeDryRunPlacement | null {
  const { resolution } = trace;
  if (resolution.outcome !== 'placed' || resolution.routeId === null) return null;
  return { boardKey: resolution.board, routeId: resolution.routeId, phase: resolution.phase };
}

function samePlacement(left: IntakeDryRunPlacement | null, right: IntakeDryRunPlacement | null): boolean {
  return left?.boardKey === right?.boardKey && left?.routeId === right?.routeId && left?.phase === right?.phase;
}

function pushKey(groups: { boardKey: string; keys: string[] }[], boardKey: string, key: string) {
  const group = groups.find(entry => entry.boardKey === boardKey);
  if (group) group.keys.push(key);
  else groups.push({ boardKey, keys: [key] });
}

export function dryRunIntake(query: IntakeDryRunQuery): IntakeDryRunResult {
  const { routes, order, registry, items, baseline, filed } = query;
  // Every board and placing rule shows, in intake order, even one no item reaches.
  const boards = new Map<string, IntakeDryRunBoard>();
  const rules = new Map<string, IntakeDryRunRule>();
  for (const boardTrace of traceIntakeOrder({ routes, order, facts: {}, registry }, { full: true }).boards) {
    const board: IntakeDryRunBoard = {
      boardKey: boardTrace.boardKey,
      name: boardTrace.name,
      takes: [],
      lostTo: [],
      rules: [],
    };
    boards.set(board.boardKey, board);
    for (const ruleTrace of boardTrace.rules) {
      const rule: IntakeDryRunRule = {
        routeId: ruleTrace.routeId,
        name: ruleTrace.name,
        enabled: ruleTrace.outcome !== 'disabled',
        takes: [],
        lost: [],
        ...(filed && { filed: filed[ruleTrace.routeId] ?? 0 }),
      };
      rules.set(rule.routeId, rule);
      board.rules.push(rule);
    }
  }

  const notRouted: string[] = [];
  const decided: IntakeDryRunItem[] = [];
  let changed = 0;
  for (const item of items) {
    const trace = traceIntakeOrder({ routes, order, facts: item.facts, registry }, { full: true });
    const placement = placementOf(trace);
    const matched: IntakeDryRunItem['matched'] = [];
    for (const boardTrace of trace.boards) {
      const board = boards.get(boardTrace.boardKey)!;
      let lostToAnother = false;
      for (const ruleTrace of boardTrace.rules) {
        const rule = rules.get(ruleTrace.routeId)!;
        if (ruleTrace.outcome === 'took') {
          rule.takes.push(item.key);
          board.takes.push(item.key);
        } else if (ruleTrace.outcome === 'lost') {
          pushKey(rule.lost, ruleTrace.to.boardKey, item.key);
          if (ruleTrace.to.boardKey !== board.boardKey) lostToAnother = true;
        } else {
          continue;
        }
        matched.push({ boardKey: board.boardKey, routeId: rule.routeId });
      }
      if (lostToAnother && placement) pushKey(board.lostTo, placement.boardKey, item.key);
    }
    if (!placement) notRouted.push(item.key);

    const entry: IntakeDryRunItem = {
      key: item.key,
      id: item.id,
      kind: item.kind,
      title: item.title,
      url: item.url,
      placement,
      matched,
    };
    if (baseline) {
      const before = placementOf(
        traceIntakeOrder({ routes: baseline.routes, order: baseline.order, facts: item.facts, registry }),
      );
      entry.before = before;
      if (!samePlacement(before, placement)) changed += 1;
    }
    decided.push(entry);
  }

  return {
    sampled: items.length,
    boards: [...boards.values()],
    notRouted,
    ...(baseline && { changed }),
    items: decided,
  };
}
