import type { IntakeOrderMigration, StoredBoardScope, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { resolveIntake } from './intake-routing.js';
import type { IntakeResolution } from './intake-routing.js';
import type { BoardRegistry } from './registry.js';

/** How many of the project's newest cards the migration compares the two evaluators on. */
export const INTAKE_ORDER_SAMPLE = 200;

export interface IntakeOrderMeasureDeps {
  storage: Pick<
    StoredBoardsStorage,
    'readIntakeOrder' | 'listIntakeRoutes' | 'claimIntakeOrderMigration' | 'recordIntakeOrderMigration'
  >;
  /** The project's cards, newest first. */
  cards(scope: StoredBoardScope): Promise<readonly Card[]>;
  boards(scope: StoredBoardScope): Promise<BoardRegistry>;
  /** Records the migration's audit event; called once per project. */
  audit(scope: StoredBoardScope, migration: IntakeOrderMigration): Promise<void>;
  warn?(message: string, error: unknown): void;
}

function boardOf(resolution: IntakeResolution): string | null {
  return resolution.outcome === 'placed' ? resolution.board : null;
}

/**
 * The one-time intake order migration of each project: derives its intake order (reading it does),
 * then runs the old and new evaluator over its newest cards and stores how many land differently
 * and how many no board takes, with an audit event. It runs whichever evaluator is on, so the
 * count is there to read before the flag flips. Arrivals only {@link start} it and never wait.
 */
export class IntakeOrderMeasure {
  readonly #deps: IntakeOrderMeasureDeps;
  readonly #running = new Map<string, Promise<IntakeOrderMigration | null>>();
  readonly #done = new Set<string>();

  constructor(deps: IntakeOrderMeasureDeps) {
    this.#deps = deps;
  }

  /** Starts the project's measure in the background unless this process knows it ran. */
  start(scope: StoredBoardScope): void {
    if (this.#done.has(key(scope))) return;
    void this.measure(scope).catch(error => this.#deps.warn?.('Factory intake order measure failed', error));
  }

  /**
   * Runs the project's measure if no replica has, returning what it found; null when another
   * replica holds it or it ran before.
   */
  measure(scope: StoredBoardScope): Promise<IntakeOrderMigration | null> {
    const id = key(scope);
    const running = this.#running.get(id);
    if (running) return running;
    const run = this.#measure(scope).finally(() => this.#running.delete(id));
    this.#running.set(id, run);
    return run;
  }

  async #measure(scope: StoredBoardScope): Promise<IntakeOrderMigration | null> {
    const { storage } = this.#deps;
    const order = await storage.readIntakeOrder(scope);
    if (order.migration?.measuredAt) {
      this.#done.add(key(scope));
      return null;
    }
    if (!(await storage.claimIntakeOrderMigration(scope))) return null;
    const [routes, registry, cards] = await Promise.all([
      storage.listIntakeRoutes(scope),
      this.#deps.boards(scope),
      this.#deps.cards(scope),
    ]);
    let differing = 0;
    let notRouted = 0;
    const sample = cards.slice(0, INTAKE_ORDER_SAMPLE);
    for (const card of sample) {
      const facts = cardRuleFacts(card);
      const query = { routes, order: order.boardKeys, facts, registry };
      const old = resolveIntake({ ...query, evaluator: 'route-list' });
      const next = resolveIntake({ ...query, evaluator: 'intake-order' });
      if (next.outcome === 'not_routed') notRouted += 1;
      if (boardOf(old) !== boardOf(next)) differing += 1;
    }
    const migration = await storage.recordIntakeOrderMigration(scope, {
      compared: sample.length,
      differing,
      notRouted,
    });
    this.#done.add(key(scope));
    await this.#deps.audit(scope, migration);
    return migration;
  }
}

function key({ orgId, factoryProjectId }: StoredBoardScope): string {
  return `${orgId}\u0000${factoryProjectId}`;
}
