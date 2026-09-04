import type { IMastraLogger } from '../../logger';
import { resolveAgentById } from '../../mastra/resolve-agent';
import type { ScheduleTarget } from '../../storage/domains/schedules/base';
import { computeScheduleDefinitionHash } from '../../workflows/scheduler/definition-hash';
import { Scheduler } from '../../workflows/scheduler/scheduler';
import type { SchedulerConfig } from '../../workflows/scheduler/types';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

/**
 * Drives cron-based workflow schedules. On each tick it polls storage
 * for due schedules, computes next fire times, and publishes
 * workflow.start events. Does not consume events — only produces them.
 *
 * This is the **single** scheduler code path. `Mastra.startWorkers()` adds it
 * when scheduling work exists or the scheduler is explicitly enabled.
 */
export class SchedulerWorker extends MastraWorker {
  readonly name = 'scheduler';

  #scheduler?: Scheduler;
  #config: SchedulerConfig;
  #running = false;

  constructor(config: SchedulerConfig = {}) {
    super();
    this.#config = config;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);

    if (!deps.storage) {
      deps.logger.warn('SchedulerWorker: no storage configured, scheduler will not run');
      return;
    }

    const schedulesStore = await deps.storage.getStore('schedules');
    if (!schedulesStore) {
      deps.logger.warn('SchedulerWorker: no schedules store available, scheduler will not run');
      return;
    }

    // Bind a target-existence predicate so the scheduler can reclaim
    // schedule rows whose target (workflow id or agent id) is no longer
    // registered with Mastra. `getWorkflowById` / `getAgentById` throw on
    // miss; we adapt that into a boolean.
    const mastra = this.mastra;
    const isTargetReady = mastra
      ? async (target: ScheduleTarget) => {
          if (target.type === 'workflow') {
            try {
              mastra.getWorkflowById(target.workflowId);
              return true;
            } catch {
              return false;
            }
          }
          if (target.type === 'agent') {
            // Only a *confirmed* miss (registry AND editor agree the agent is
            // gone) counts toward deletion. A transient editor/storage failure
            // is treated as ready: the schedule fires, and the execute path
            // retries resolution and records a failed trigger row without
            // deleting the schedule. Trade-off: during a sustained editor
            // outage each due tick publishes a fire that fails at execute
            // time — noisy, but never destroys a schedule on ambiguity.
            const resolved = await resolveAgentById(mastra, target.agentId);
            return resolved.status !== 'missing';
          }
          return false;
        }
      : undefined;

    // Bind a stale-build fence (#19169): scheduled runs execute `localOnly`
    // in the claiming process against its own workflow registry, so an
    // instance whose local step graph differs from the hash recorded on the
    // schedule row (a straggler from a previous deploy) must not claim the
    // fire. Fails open for rows without a hash (legacy/imperative
    // schedules) and for agent targets, which have no step graph.
    const isTargetCurrent = mastra
      ? (target: ScheduleTarget) => {
          if (target.type !== 'workflow' || !target.definitionHash) return true;
          try {
            const workflow = mastra.getWorkflowById(target.workflowId);
            const localHash = computeScheduleDefinitionHash(workflow.serializedStepGraph);
            // Unhashable local graph → can't compare, fail open.
            if (!localHash) return true;
            return localHash === target.definitionHash;
          } catch {
            // Missing workflow is the readiness predicate's concern.
            return true;
          }
        }
      : undefined;

    // Claim/execute affinity (#19169). Workers receive the *raw* pubsub, not
    // the `Mastra.pubsub` proxy that tags run-scoped workflow events
    // `localOnly`, so without this the scheduler's fire always fans out to
    // every instance on the shared topic. Evaluated per fire rather than
    // captured here because execution workers can start lazily
    // (`__ensureExecutionWorkersStarted`) after the scheduler is already up.
    const canExecuteLocally = mastra ? () => mastra.__hasLocalWorkflowExecution() : undefined;

    this.#scheduler = new Scheduler({
      schedulesStore,
      pubsub: deps.pubsub,
      config: { ...this.#config, isTargetReady, isTargetCurrent, canExecuteLocally },
    });
    this.#scheduler.__setLogger(deps.logger as IMastraLogger);

    // Register declarative schedules from workflow configs before starting
    // the tick loop. This syncs code-declared schedules to the DB.
    if (this.mastra) {
      try {
        await this.mastra.registerDeclarativeSchedules(schedulesStore);
      } catch (err) {
        deps.logger.error?.('SchedulerWorker: failed to register declarative schedules', { error: err });
      }
    }
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (this.#scheduler) {
      await this.#scheduler.start();
    }
    this.#running = true;
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    if (this.#scheduler) {
      await this.#scheduler.stop();
    }
    this.#running = false;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  /** Expose the underlying scheduler for direct API access (e.g., schedule management). */
  get scheduler(): Scheduler | undefined {
    return this.#scheduler;
  }
}
