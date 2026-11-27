import type { Settings } from '../config/settings.js';
import { ControlPlaneError } from '../core/contracts.js';
import type { AdvisorySync } from './sync.js';

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
  /** Run one due advisory schedule event while preventing overlapping scheduler ticks. */
  private async tick() {
    if (this.closed || !this.settings.SCANNER_ADVISORY_SYNC_ENABLED) return;
    const id = await this.sync.store.claimSchedule();
    if (!id) return;
    try {
      if (this.closed) throw new ControlPlaneError('ADVISORY_SCHEDULE_CLOSED', 503);
      const result = await this.sync.syncOnce();
      if (this.closed) throw new ControlPlaneError('ADVISORY_SCHEDULE_CLOSED', 503);
      if (result.outcome === 'SKIPPED') {
        await this.sync.store.finishScheduledEvent(id, 'SKIPPED', result.reasonCode);
        return;
      }
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
  /** Admit the due advisory event and persist its completed, skipped or failed outcome. */
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
