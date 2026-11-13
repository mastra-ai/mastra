import type { IntakeOrderMigration, StoredBoardScope, StoredBoardsStorage } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { resolveIntake } from './intake-routing.js';
import type { IntakeResolution } from './intake-routing.js';
import type { BoardRegistry } from './registry.js';

/** How many of the project's newest cards the migration compares the two evaluators on. */
export const INTAKE_ORDER_SAMPLE = 200;

/** How many times a measure starts over when rule writes keep re-deriving the order under it. */
const MEASURE_ATTEMPTS = 3;

export interface IntakeOrderMeasureDeps {
  storage: Pick<
    StoredBoardsStorage,
    'readIntakeOrder' | 'listIntakeRoutes' | 'claimIntakeOrderMigration' | 'recordIntakeOrderMigration'
  >;
  /** The project's cards, newest first. */
  cards(scope: StoredBoardScope): Promise<readonly Card[]>;
  boards(scope: StoredBoardScope): Promise<BoardRegistry>;
  /** Records the migration's audit event, at most once per measured order however often called; throws when it isn't written. */
  audit(scope: StoredBoardScope, migration: IntakeOrderMigration): Promise<void>;
  warn?(message: string, error: unknown): void;
}

function boardOf(resolution: IntakeResolution): string | null {
  return resolution.outcome === 'placed' ? resolution.board : null;
}

/**
 * The intake order migration of each project: derives its intake order (reading it does), then
 * runs the old and new evaluator over its newest cards and stores how many land differently and
 * how many no board takes, with an audit event. It runs whichever evaluator is on, so the count is
 * there to read before the flag flips. While the order is derived, every rule write drops the
 * result and {@link restart}s it, so the count describes the rules as they are now. Arrivals only
 * {@link start} it and never wait.
 */
export class IntakeOrderMeasure {
  readonly #deps: IntakeOrderMeasureDeps;
  readonly #running = new Map<string, Promise<IntakeOrderMigration | null>>();
  readonly #done = new Set<string>();
  /** Projects whose order changed while their measure ran: measure again once it ends. */
  readonly #again = new Set<string>();

  constructor(deps: IntakeOrderMeasureDeps) {
    this.#deps = deps;
  }

  /** Starts the project's measure in the background unless this process knows it ran. */
  start(scope: StoredBoardScope): void {
    if (this.#done.has(key(scope))) return;
    void this.measure(scope).catch(error => this.#deps.warn?.('Factory intake order measure failed', error));
  }

  /**
   * Measures the project again after a rule write, when that write dropped its result (the order is
   * still derived). Resolves like {@link measure}, null when it fails; callers don't wait for it.
   */
  restart(scope: StoredBoardScope): Promise<IntakeOrderMigration | null> {
    const id = key(scope);
    this.#done.delete(id);
    const running = this.#running.get(id);
    if (running) this.#again.add(id);
    const run = running ? running.then(() => this.#running.get(id) ?? null) : this.measure(scope);
    return run.catch(error => {
      this.#deps.warn?.('Factory intake order measure failed', error);
      return null;
    });
  }

  /**
   * Runs the project's measure if no replica has, returning what it found; null when another
   * replica holds it or it ran before.
   */
  measure(scope: StoredBoardScope): Promise<IntakeOrderMigration | null> {
    const id = key(scope);
    const running = this.#running.get(id);
    if (running) return running;
    const run = this.#measureFresh(scope).finally(() => {
      this.#running.delete(id);
      if (this.#again.delete(id)) {
        void this.measure(scope).catch(error => this.#deps.warn?.('Factory intake order measure failed', error));
      }
    });
    this.#running.set(id, run);
    return run;
  }

  /** A measure whose order a rule write re-derived while it ran is dropped, so start over. */
  async #measureFresh(scope: StoredBoardScope): Promise<IntakeOrderMigration | null> {
    for (let attempt = 1; ; attempt += 1) {
      const result = await this.#measure(scope);
      if (result !== 'superseded') return result;
      if (attempt === MEASURE_ATTEMPTS) return null;
    }
  }

  async #measure(scope: StoredBoardScope): Promise<IntakeOrderMigration | null | 'superseded'> {
    const { storage } = this.#deps;
    const registry = await this.#deps.boards(scope);
    const order = await storage.readIntakeOrder(scope, { boards: [...registry.keys()] });
    if (order.migration?.measuredAt) {
      // Measured, maybe by a run whose audit failed: the audit is keyed to the measure, so this
      // writes it at most once.
      await this.#deps.audit(scope, order.migration);
      this.#done.add(key(scope));
      return null;
    }
    const claimed = await storage.claimIntakeOrderMigration(scope);
    if (claimed === null) return null;
    const [routes, cards] = await Promise.all([storage.listIntakeRoutes(scope), this.#deps.cards(scope)]);
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
    const migration = await storage.recordIntakeOrderMigration(
      scope,
      { compared: sample.length, differing, notRouted },
      { claimed },
    );
    if (!migration) return 'superseded';
    // Until the audit is written the project isn't done: the next start writes it.
    await this.#deps.audit(scope, migration);
    this.#done.add(key(scope));
    return migration;
  }
}

function key({ orgId, factoryProjectId }: StoredBoardScope): string {
  return `${orgId}\u0000${factoryProjectId}`;
}
