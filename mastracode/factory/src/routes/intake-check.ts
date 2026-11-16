/**
 * The intake dry run and "Where would this go?" tester behind the intake routes. Both decide with
 * the intake order evaluator's own code ({@link traceIntakeOrder}), so they answer what filing
 * does under `intake-order`; a project still on `route-list` files differently, and the responses
 * say which evaluator it runs. Both use saved rules or a draft of them, and write nothing: no
 * decision rows, no cards, no audit events, and no provider writes.
 */

import type { z } from 'zod';

import { DEFAULT_ROUTE_EVENTS, isUpdateEvent } from '../boards/board-events.js';
import type { BoardEventFacts } from '../boards/board-events.js';
import { cardRuleFacts } from '../boards/card-facts.js';
import { dryRunIntake, intakeSample } from '../boards/intake-dry-run.js';
import { lookupIntakeItem } from '../boards/intake-lookup.js';
import type { IntakeItemLookup } from '../boards/intake-lookup.js';
import {
  arrivalRuleFacts,
  INTAKE_ORDER_SAMPLE,
  INTAKE_ROUTE_METADATA_KEY,
  intakeTargetProblem,
  planEventMove,
  traceIntakeOrder,
} from '../boards/intake-routing.js';
import type { BoardRegistry } from '../boards/registry.js';
import { boardForWorkItem } from '../boards/semantics.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import {
  eventRouteIngress,
  FOLDABLE_UPDATE_STATUSES,
  foldUpdate,
  updateGroup,
  updateSuperseded,
} from '../rules/update-fold.js';
import type {
  StoredBoardScope,
  StoredBoardsStorage,
  StoredIntakeDecisionRecord,
  StoredIntakeRouteRecord,
} from '../storage/domains/boards/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { intakeDryRunBodySchema, intakeTestBodySchema } from './contracts.js';

type DryRunBody = z.infer<typeof intakeDryRunBodySchema>;
type TestBody = z.infer<typeof intakeTestBodySchema>;
type Draft = Pick<DryRunBody, 'boards' | 'order'>;
type DraftRoute = Pick<StoredIntakeRouteRecord, 'id' | 'name' | 'enabled' | 'when' | 'target' | 'on'>;
type LinkedDecision = Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>;

/** How many of a card's newest status events the tester replays. */
export const RECENT_CARD_EVENTS = 10;
/** How many of a card's newest decisions the tester reads to find and fold its recent events. */
export const CARD_HISTORY = 200;

/** How far back the live counts read the decision log. */
export const INTAKE_FILED_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** A request the check refuses: an unknown board in a draft, or a URL it can't test. */
export class IntakeCheckRefusal extends Error {
  constructor(
    readonly status: 404 | 422,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface IntakeCheckDeps {
  storage: Pick<
    StoredBoardsStorage,
    'listIntakeRoutes' | 'readIntakeOrder' | 'listRecentNotRouted' | 'countPlacedByRoute' | 'getIntakeDecision'
  >;
  workItems: Pick<WorkItemsStorage, 'listShared' | 'get' | 'listDeferredDecisions' | 'getTransitionResultByIngress'>;
  /** Providers that can read an item by URL; Linear, Jira and incident.io items are picked from recent ones. */
  lookups?: readonly IntakeItemLookup[];
  now?: () => Date;
}

/** Whether the request runs anything but the saved rules and order, which needs the right to edit them. */
export function isDraft(body: { boards?: unknown; order?: unknown }): boolean {
  return body.boards !== undefined || body.order !== undefined;
}

export class IntakeCheck {
  constructor(private readonly deps: IntakeCheckDeps) {}

  async #saved(scope: StoredBoardScope, registry: BoardRegistry) {
    const [routes, order] = await Promise.all([
      this.deps.storage.listIntakeRoutes(scope),
      this.deps.storage.readIntakeOrder(scope, { boards: [...registry.keys()] }),
    ]);
    return { routes, order: order.boardKeys.filter(key => registry.has(key)) };
  }

  /** The saved rules with each drafted board's rules swapped for its draft, and the draft order if any. */
  #draft(saved: { routes: readonly DraftRoute[]; order: string[] }, body: Draft, registry: BoardRegistry) {
    let routes: DraftRoute[] = [...saved.routes];
    for (const board of body.boards ?? []) {
      if (!registry.has(board.boardKey)) {
        throw new IntakeCheckRefusal(422, 'intake_board_not_found', `No board "${board.boardKey}" in this project.`);
      }
      const drafts = board.routes.map((route, index) => ({
        id: route.id ?? `draft:${board.boardKey}:${index}`,
        name: route.name,
        enabled: route.enabled,
        when: route.when,
        target: {
          boardKey: board.boardKey,
          phaseKey: route.target.phaseKey ?? null,
          joinClosedIssue: route.target.joinClosedIssue ?? false,
          moveToBoardKey: route.target.moveToBoardKey ?? null,
        },
        on: route.on ?? [...DEFAULT_ROUTE_EVENTS],
      }));
      // Held to the checks saving it would face, so a typo'd phase can't quietly land on the first one.
      for (const route of drafts) {
        const problem = intakeTargetProblem(registry, route);
        if (problem) throw new IntakeCheckRefusal(422, problem.code, problem.message);
      }
      routes = routes.filter(route => route.target.boardKey !== board.boardKey);
      routes.push(...drafts);
    }
    if (new Set(routes.map(route => route.id)).size !== routes.length) {
      throw new IntakeCheckRefusal(
        422,
        'intake_draft_rule_id_repeated',
        'Two rules share an id; give each drafted rule its own id, or none.',
      );
    }
    // The same check saving the order faces, so a preview never shows an order that can't be saved.
    if (body.order && (body.order.length !== registry.size || body.order.some(key => !registry.has(key)))) {
      throw new IntakeCheckRefusal(
        422,
        'intake_order_set_mismatch',
        'The intake order must list every board of the project exactly once; reload the boards and try again.',
      );
    }
    return { routes, order: body.order ?? saved.order };
  }

  async #sample(scope: StoredBoardScope, registry: BoardRegistry) {
    const [cards, notRouted] = await Promise.all([
      this.deps.workItems.listShared(scope),
      this.deps.storage.listRecentNotRouted(scope, INTAKE_ORDER_SAMPLE),
    ]);
    return intakeSample({
      cards,
      notRouted,
      factoryProjectId: scope.factoryProjectId,
      registry,
      card: this.#card(scope),
    });
  }

  #card(scope: StoredBoardScope) {
    return (id: string) => this.deps.workItems.get({ orgId: scope.orgId, id });
  }

  async dryRun(scope: StoredBoardScope, registry: BoardRegistry, body: DryRunBody) {
    const now = this.deps.now?.() ?? new Date();
    const [saved, items, filed] = await Promise.all([
      this.#saved(scope, registry),
      this.#sample(scope, registry),
      this.deps.storage.countPlacedByRoute(scope, new Date(now.getTime() - INTAKE_FILED_WINDOW_MS)),
    ]);
    const draft = this.#draft(saved, body, registry);
    return dryRunIntake({
      ...draft,
      registry,
      items,
      filed,
      ...(isDraft(body) && { baseline: saved }),
    });
  }

  async test(scope: StoredBoardScope, registry: BoardRegistry, body: TestBody) {
    // The draft is checked before the item is read, so a refused draft never costs a provider fetch.
    const { routes, order } = this.#draft(await this.#saved(scope, registry), body, registry);
    const item = await this.#item(scope, registry, body);
    const { resolution, boards } = traceIntakeOrder({ routes, order, facts: item.facts, registry }, { full: true });
    const { card } = item;
    return {
      item: { title: item.title, url: item.url, kind: item.kind, id: item.id },
      current: card
        ? {
            boardKey: boardForWorkItem(card),
            phase: card.stages.length === 1 ? card.stages[0]! : null,
            routeId:
              typeof card.metadata?.[INTAKE_ROUTE_METADATA_KEY] === 'string'
                ? (card.metadata[INTAKE_ROUTE_METADATA_KEY] as string)
                : null,
          }
        : null,
      moves: card ? await this.#moves(scope, registry, routes, card, body.event) : [],
      placement:
        resolution.outcome === 'placed' && resolution.routeId !== null
          ? { boardKey: resolution.board, routeId: resolution.routeId, phase: resolution.phase }
          : null,
      reason: resolution.outcome === 'not_routed' ? resolution.reason : null,
      note:
        item.kind === 'fetched' && item.facts['source.kind'] === 'pull_request'
          ? "A pull request that closes an issue with a card, or comes from a card's branch, joins that card instead; this test doesn't check for that."
          : null,
      boards,
    };
  }

  /**
   * The event sent in the request, then the card's newest status events, each replayed through the
   * card-move rules (`planEventMove`, as the dispatcher files them) against the card as it is now.
   */
  async #moves(
    scope: StoredBoardScope,
    registry: BoardRegistry,
    routes: readonly DraftRoute[],
    card: Card,
    tried: BoardEventFacts | undefined,
  ) {
    // Bounded: an update burst longer than this folds from the part read, where dispatch folds all of it.
    const records = await this.deps.workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId, {
      newest: CARD_HISTORY,
      workItemId: card.id,
    });
    const moveCommitted = async (other: (typeof records)[number]) =>
      Boolean(
        await this.deps.workItems.getTransitionResultByIngress(
          scope.orgId,
          scope.factoryProjectId,
          eventRouteIngress(other.idempotencyKey),
        ),
      );
    // Each update's fold group, built once rather than per record.
    const groups = new Map<string, typeof records>();
    const groupOf = (decision: Extract<FactoryCommitDecision, { type: 'routeEvent' }>) => {
      const key = `${decision.event.type}:${decision.fromCardSession === true}`;
      let group = groups.get(key);
      if (!group) groups.set(key, (group = updateGroup(records, decision)));
      return group;
    };
    // Which events to show is decided from the records alone, so only those shown are folded:
    // folding reads storage for each earlier update of a burst.
    const shown = records
      .flatMap((record): { record: typeof record; decision: FactoryCommitDecision }[] => {
        // Stored decisions are JSON; these two kinds are the ones that carry a status event.
        const decision = record.decision as unknown as FactoryCommitDecision;
        if (decision.type === 'transition' && decision.event) return [{ record, decision }];
        if (decision.type !== 'routeEvent') return [];
        if (!isUpdateEvent(decision.event.type)) return [{ record, decision }];
        // Updates replay as the dispatcher acts on them: folded into the newest of a burst.
        if (record.status === 'superseded') return [];
        if (FOLDABLE_UPDATE_STATUSES.has(record.status) && updateSuperseded(groupOf(decision), record.id)) {
          return [];
        }
        return [{ record, decision }];
      })
      .slice(-RECENT_CARD_EVENTS);
    const stored = await Promise.all(
      shown.map(
        async ({
          record,
          decision,
        }): Promise<{ record: typeof record; event: BoardEventFacts | undefined; fallback?: { stage: string } }> => {
          if (decision.type === 'routeEvent' && isUpdateEvent(decision.event.type)) {
            const fold = await foldUpdate(groupOf(decision), record.id, moveCommitted);
            return { record, event: fold.event };
          }
          if (decision.type === 'routeEvent') return { record, event: decision.event };
          if (decision.type === 'transition' && decision.event) {
            return { record, event: decision.event, fallback: { stage: decision.stage } };
          }
          throw new Error(`Decision ${record.id} carries no status event.`);
        },
      ),
    );
    const replays: {
      decisionId: string | null;
      at: string | null;
      event: BoardEventFacts;
      netsOut?: boolean;
      fallback?: { stage: string };
    }[] = [
      ...(tried ? [{ decisionId: null, at: null, event: tried }] : []),
      ...stored.toReversed().map(({ record, event, fallback }) => ({
        decisionId: record.id,
        at: record.createdAt.toISOString(),
        event: event ?? (record.decision as unknown as { event: BoardEventFacts }).event,
        ...(event === undefined && { netsOut: true }),
        ...(fallback && { fallback }),
      })),
    ];
    return replays.map(({ fallback, netsOut, ...replay }) => {
      // The dispatcher drops an update burst whose labels and assignees end where they started.
      if (netsOut) {
        return {
          ...replay,
          outcome: 'ignored' as const,
          to: null,
          phase: null,
          reason: 'Its labels and assignees end where they started, so it moves nothing.',
          rules: [],
        };
      }
      const plan = planEventMove(
        { routes, event: replay.event, item: card, registry, ...(fallback && { fallback }) },
        { full: true },
      );
      return {
        ...replay,
        outcome: plan.outcome,
        to:
          plan.outcome === 'moves'
            ? { boardKey: plan.move.board, phase: plan.move.phase, routeId: plan.move.routeId }
            : null,
        phase: plan.outcome === 'rule_default' ? plan.phase : null,
        reason: plan.outcome === 'ignored' ? plan.reason : null,
        rules: plan.rules,
      };
    });
  }

  /** The item to test: a recent card or Not routed item by id or URL, else one read from its provider. */
  async #item(
    scope: StoredBoardScope,
    registry: BoardRegistry,
    body: TestBody,
  ): Promise<{
    title: string;
    url: string | null;
    kind: 'card' | 'not_routed' | 'fetched';
    id: string | null;
    facts: RuleFacts;
    card?: Card;
  }> {
    // Only a card moves: an event refuses anything else before a provider is asked for it.
    const needsCard = () => {
      if (body.event) {
        throw new IntakeCheckRefusal(
          422,
          'intake_event_needs_card',
          "Only a card moves on an event; pick one of the project's cards.",
        );
      }
    };
    if (body.itemId) {
      const card = await this.deps.workItems.get({ orgId: scope.orgId, id: body.itemId });
      if (card && card.factoryProjectId === scope.factoryProjectId) return fromCard(card);
      const decision = await this.deps.storage.getIntakeDecision(scope, body.itemId);
      if (decision?.arrival) {
        needsCard();
        return this.#notRouted(scope, registry, decision);
      }
      throw new IntakeCheckRefusal(404, 'intake_item_not_found', 'No such item in this project.');
    }
    const url = body.url!;
    const card = (await this.deps.workItems.listShared(scope)).find(
      // The card's own source or any it holds since, such as a pull request linked to an issue card.
      entry => entry.workItem.sources.some(source => source.url !== null && sameUrl(source.url, url)),
    );
    if (card) return fromCard(card);
    needsCard();
    const decision = (await this.deps.storage.listRecentNotRouted(scope, INTAKE_ORDER_SAMPLE)).find(
      entry => entry.arrival && entry.url !== null && sameUrl(entry.url, url),
    );
    const found = await lookupIntakeItem(this.deps.lookups ?? [], scope, url);
    // A Not routed item may have changed since: a label or a reopen takes it in again with the facts it
    // has now, so those answer. Its stored arrival answers only when the provider can't be read.
    if (found.status === 'found')
      return { title: found.title, url: found.url, kind: 'fetched', id: null, facts: found.facts };
    if (decision?.arrival) return this.#notRouted(scope, registry, decision);
    if (found.status === 'not_linked') {
      throw new IntakeCheckRefusal(
        422,
        'not_linked',
        "That item belongs to a repository or team this project isn't linked to.",
      );
    }
    if (found.status === 'not_found') {
      throw new IntakeCheckRefusal(
        404,
        'intake_item_not_found',
        "The provider has no such item, or it couldn't be read.",
      );
    }
    throw new IntakeCheckRefusal(
      422,
      'intake_url_unsupported',
      'Paste a GitHub or GitLab issue or pull request URL, or pick a recent item.',
    );
  }

  async #notRouted(scope: StoredBoardScope, registry: BoardRegistry, decision: StoredIntakeDecisionRecord) {
    return {
      title: decision.title,
      url: decision.url,
      kind: 'not_routed' as const,
      id: decision.id,
      facts: await arrivalRuleFacts(decision.arrival as unknown as LinkedDecision, {
        factoryProjectId: scope.factoryProjectId,
        registry,
        card: this.#card(scope),
      }),
    };
  }
}

function fromCard(card: Card) {
  return {
    title: card.title,
    url: card.externalSource?.url ?? null,
    kind: 'card' as const,
    id: card.id,
    facts: cardRuleFacts(card),
    card,
  };
}

// An issue, pull request or merge request URL: host, repository path, kind and number; a tab after it is ignored.
const ITEM_URL =
  /^https?:\/\/(?:www\.)?([^/]+)\/(.+?)\/(-\/)?(issues|pull|pulls|merge_requests|work_items)\/(\d+)(?:[/?#]|$)/i;

/** Whether two URLs name the same item. GitHub numbers issues and pull requests together; GitLab doesn't. */
function sameUrl(left: string, right: string): boolean {
  const identity = (url: string) => {
    const match = ITEM_URL.exec(url.trim());
    if (!match) return url.trim().replace(/\/+$/, '').toLowerCase();
    const [, host, path, gitlab, kind, number] = match;
    const family = !gitlab ? 'item' : kind!.toLowerCase() === 'merge_requests' ? 'merge_request' : 'issue';
    return `${host!.toLowerCase()}/${path!.toLowerCase()}/${family}/${number}`;
  };
  return identity(left) === identity(right);
}
