import { MastraWorker } from '@mastra/core/worker';
import type { LibSQLStore } from '@mastra/libsql';

import type { createSourceSyncWorkflow } from '../workflows/source-sync.js';
import type { SourceIndex } from '../workspaces/source-index.js';

type SourceSyncWorkflow = ReturnType<typeof createSourceSyncWorkflow>;
const SYNC_INTERVAL_MS = 5 * 60 * 1_000;

export class InitialSynchronization extends MastraWorker {
  readonly name = 'organization-initial-sync';
  #running = false;

  constructor(
    private readonly index: SourceIndex,
    private readonly storage: LibSQLStore,
    private readonly workflow: SourceSyncWorkflow,
  ) {
    super();
  }

  async start(): Promise<void> {
    if (this.#running) return;
    await this.index.initialize();
    await this.deferOverdueSchedules();
    const run = await this.workflow.createRun();
    await run.start({ inputData: { trigger: 'startup' } });
    this.#running = true;
  }

  async stop(): Promise<void> {
    this.#running = false;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  private async deferOverdueSchedules(): Promise<void> {
    const schedules = await this.storage.getStore('schedules');
    if (!schedules) return;
    const now = Date.now();
    for (const schedule of await schedules.listSchedules()) {
      if (
        schedule.target.type !== 'workflow' ||
        schedule.target.workflowId !== this.workflow.id ||
        schedule.nextFireAt > now
      )
        continue;
      await schedules.updateSchedule(schedule.id, {
        nextFireAt: (Math.floor(now / SYNC_INTERVAL_MS) + 1) * SYNC_INTERVAL_MS,
      });
    }
  }
}
