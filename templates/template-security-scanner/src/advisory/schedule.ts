import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import type { Settings } from '../config/settings.js';
import { ControlPlaneError } from '../core/contracts.js';
import type { AdvisorySync } from './sync.js';

export function createAdvisorySyncWorkflow(settings: Settings, processDue: () => Promise<void>) {
  const empty = z.object({}).strict();
  const step = createStep({
    id: 'process-due-advisory-sync',
    inputSchema: empty,
    outputSchema: empty,
    execute: async () => {
      await processDue();
      return {};
    },
  });
  return createWorkflow({
    id: 'local-advisory-sync',
    inputSchema: empty,
    outputSchema: empty,
    schedule: {
      id: 'local-advisory-sync-wake',
      cron: settings.SCANNER_ADVISORY_SYNC_CRON!,
      timezone: settings.SCANNER_ADVISORY_SYNC_TIMEZONE!,
      inputData: {},
    },
  })
    .then(step)
    .commit();
}

export class AdvisoryScheduler {
  private active?: Promise<void>;
  private closed = false;
  constructor(
    private readonly settings: Settings,
    private readonly sync: AdvisorySync,
    private readonly onImported: () => Promise<void>,
  ) {}
  initialize() {
    return this.sync.store.configureSchedule(this.settings);
  }
  private async tick() {
    if (this.closed || !this.settings.SCANNER_ADVISORY_SYNC_ENABLED) return;
    const id = await this.sync.store.claimSchedule();
    if (!id) return;
    try {
      if (this.closed) throw new ControlPlaneError('ADVISORY_SCHEDULE_CLOSED', 503);
      await this.sync.syncOnce();
      if (this.closed) throw new ControlPlaneError('ADVISORY_SCHEDULE_CLOSED', 503);
      await this.onImported();
      await this.sync.store.finishScheduledEvent(id, 'COMPLETE', null);
    } catch (error) {
      await this.sync.store.finishScheduledEvent(
        id,
        'FAILED',
        error instanceof ControlPlaneError ? error.code : 'ADVISORY_SCHEDULE_FAILED',
      );
    }
  }
  runDue() {
    if (this.closed || this.active) return this.active ?? Promise.resolve();
    const work = this.tick();
    this.active = work;
    void work
      .finally(() => {
        this.active = undefined;
      })
      .catch(() => undefined);
    return work;
  }
  async close() {
    this.closed = true;
    await this.active;
  }
}
