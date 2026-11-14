/**
 * The intake dry run and "Where would this go?" tester behind the intake routes. Both decide with
 * the evaluator filing uses, over saved rules or a draft of them, and write nothing: no decision
 * rows, no cards, no audit events, and no provider writes.
 */

import type { z } from 'zod';

import { DEFAULT_ROUTE_EVENTS } from '../boards/board-events.js';
import { cardRuleFacts } from '../boards/card-facts.js';
import { dryRunIntake, intakeSample } from '../boards/intake-dry-run.js';
import { lookupIntakeItem } from '../boards/intake-lookup.js';
import type { IntakeItemLookup } from '../boards/intake-lookup.js';
import {
  arrivalRuleFacts,
  INTAKE_ORDER_SAMPLE,
  intakeTargetProblem,
  traceIntakeOrder,
} from '../boards/intake-routing.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { FactoryCommitDecision } from '../rules/types.js';
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
  workItems: Pick<WorkItemsStorage, 'listShared' | 'get'>;
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
        target: { boardKey: board.boardKey, phaseKey: route.target.phaseKey ?? null, joinClosedIssue: false },
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
    return {
      item: { title: item.title, url: item.url, kind: item.kind, id: item.id },
      placement:
        resolution.outcome === 'placed' && resolution.routeId !== null
          ? { boardKey: resolution.board, routeId: resolution.routeId, phase: resolution.phase }
          : null,
      reason: resolution.outcome === 'not_routed' ? resolution.reason : null,
      boards,
    };
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
  }> {
    if (body.itemId) {
      const card = await this.deps.workItems.get({ orgId: scope.orgId, id: body.itemId });
      if (card && card.factoryProjectId === scope.factoryProjectId) return fromCard(card);
      const decision = await this.deps.storage.getIntakeDecision(scope, body.itemId);
      if (decision?.arrival) return this.#notRouted(scope, registry, decision);
      throw new IntakeCheckRefusal(404, 'intake_item_not_found', 'No such item in this project.');
    }
    const url = body.url!;
    const card = (await this.deps.workItems.listShared(scope)).find(
      entry => entry.externalSource?.url !== undefined && sameUrl(entry.externalSource.url, url),
    );
    if (card) return fromCard(card);
    const decision = (await this.deps.storage.listRecentNotRouted(scope, INTAKE_ORDER_SAMPLE)).find(
      entry => entry.arrival && entry.url !== null && sameUrl(entry.url, url),
    );
    if (decision?.arrival) return this.#notRouted(scope, registry, decision);
    const found = await lookupIntakeItem(this.deps.lookups ?? [], scope, url);
    if (found.status === 'found')
      return { title: found.title, url: found.url, kind: 'fetched', id: null, facts: found.facts };
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
  };
}

function sameUrl(left: string, right: string): boolean {
  const normalize = (url: string) => url.trim().replace(/\/+$/, '').toLowerCase();
  return normalize(left) === normalize(right);
}
