import { applyStatePatch, diffState } from '@mastra/core/storage';
import type { StatePatchOp, WorkflowRunHeader, WorkflowsStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';
import { NOT_CANCELED_STATUSES } from './contracts';

/** A planned write: what changed since the writer's view of the stored run. */
export interface RunWritePlan {
  header: WorkflowRunHeader;
  steps: Record<string, StepResult<any, any, any, any>>;
  statePatch: StatePatchOp[];
}

const toJson = (value: unknown) => JSON.stringify(value ?? null);
const cloneJson = <T>(value: T): T => JSON.parse(toJson(value));

/**
 * Writes a storage v2 Inngest run. It keeps a view of what the store holds, so each write sends
 * only the step results and state paths that changed since.
 *
 * Plans are made outside Inngest steps and the store calls run inside them. A replayed request
 * re-plans the same writes from the same start and folds in their memoized results, so the view
 * evolves the same way on every request without re-sending anything.
 */
export class InngestRunWriter {
  readonly #store: WorkflowsStorage;
  readonly workflowName: string;
  readonly runId: string;
  readonly resourceId?: string;
  #stepJson = new Map<string, string>();
  #state: Record<string, any>;
  #header?: WorkflowRunHeader;
  #seq?: number;
  #lastStatus?: WorkflowRunState['status'];

  constructor(args: {
    store: WorkflowsStorage;
    workflowName: string;
    runId: string;
    resourceId?: string;
    /** The stored run's state when this drive starts. */
    state: Record<string, any>;
    /** The stored run's step results when this drive starts (a resume). */
    steps?: Record<string, unknown>;
  }) {
    this.#store = args.store;
    this.workflowName = args.workflowName;
    this.runId = args.runId;
    this.resourceId = args.resourceId;
    this.#state = cloneJson(args.state ?? {});
    for (const [id, result] of Object.entries(args.steps ?? {})) this.#stepJson.set(id, toJson(result));
  }

  get store(): WorkflowsStorage {
    return this.#store;
  }

  /** The highest run seq this writer saw a write reach. */
  get seq(): number | undefined {
    return this.#seq;
  }

  get lastStatus(): WorkflowRunState['status'] | undefined {
    return this.#lastStatus;
  }

  set lastStatus(status: WorkflowRunState['status'] | undefined) {
    this.#lastStatus = status;
  }

  /** The last header a write sent. */
  get header(): WorkflowRunHeader | undefined {
    return this.#header;
  }

  /**
   * Plans writing `snapshot`. With `stepIds` (a step's start), only those step results are sent and the
   * state isn't; without, every changed step result and the state are.
   */
  plan(snapshot: WorkflowRunState, stepIds?: readonly string[]): RunWritePlan {
    const { context, value, ...header } = snapshot;
    const steps: RunWritePlan['steps'] = {};
    for (const [id, result] of Object.entries(context ?? {})) {
      if (stepIds && !stepIds.includes(id)) continue;
      if (this.#stepJson.get(id) !== toJson(result)) steps[id] = cloneJson(result) as StepResult<any, any, any, any>;
    }
    return {
      header: cloneJson(header) as WorkflowRunHeader,
      steps,
      statePatch: stepIds ? [] : diffState(this.#state, cloneJson(value ?? {})),
    };
  }

  /** Sends a plan. Null when the run is canceled. */
  async send(plan: RunWritePlan): Promise<{ lastSeq: number } | null> {
    const written = await this.#store.appendWorkflowRunEntries({
      workflowName: this.workflowName,
      runId: this.runId,
      resourceId: this.resourceId,
      header: plan.header,
      steps: plan.steps,
      ...(plan.statePatch.length ? { statePatch: plan.statePatch } : {}),
      expectedStatus: NOT_CANCELED_STATUSES,
    });
    return written ? { lastSeq: written.lastSeq } : null;
  }

  /** Folds a sent plan into the writer's view. */
  commit(plan: RunWritePlan, written: { lastSeq: number }): void {
    for (const [id, result] of Object.entries(plan.steps)) this.#stepJson.set(id, toJson(result));
    this.#header = plan.header;
    this.commitState(plan.statePatch, written.lastSeq);
  }

  /** Folds state ops a write or an adoption stored at `seq` into the writer's view. */
  commitState(ops: StatePatchOp[], seq: number): void {
    if (ops.length) this.#state = applyStatePatch(this.#state, ops);
    this.#seq = Math.max(this.#seq ?? 0, seq);
  }
}
