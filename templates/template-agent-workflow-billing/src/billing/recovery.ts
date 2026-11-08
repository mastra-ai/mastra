import { z } from 'zod';
import { BillingError, parseInput } from './contracts.js';
import type { BillingProvider, RawWebhookRequest } from './contracts.js';
import { RecoveryStorage } from './storage/recovery.js';

export class BillingRecovery {
  private active: Promise<void> | undefined;
  private stopped = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly settings;
  constructor(
    private readonly storage: RecoveryStorage,
    private readonly provider: BillingProvider,
    private readonly expireSuspensions: () => Promise<unknown> = async () => {},
    options: { batchSize?: number; leaseMs?: number; intervalMs?: number } = {},
  ) {
    this.settings = parseInput(
      z.strictObject({
        batchSize: z.number().int().min(1).max(100),
        leaseMs: z.number().int().min(100).max(300000),
        intervalMs: z.number().int().min(100).max(3600000),
      }),
      {
        batchSize: options.batchSize ?? 10,
        leaseMs: options.leaseMs ?? 60000,
        intervalMs: options.intervalMs ?? 30000,
      },
    );
  }
  async intake(request: RawWebhookRequest) {
    const notification = await this.provider.verifyWebhook(request);
    if (notification.status !== 'verified') throw new BillingError('unsupported');
    return this.storage.enqueue(notification);
  }
  runOnce(): Promise<void> {
    if (this.stopped) return Promise.resolve();
    if (this.active) return this.active;
    const work = async () => {
      await this.storage.recoverInterrupted();
      await this.expireSuspensions();
      for (const claim of await this.storage.claimDeliveries({
        batchSize: this.settings.batchSize,
        leaseMs: this.settings.leaseMs,
      }))
        await this.storage.deliver(this.provider, claim);
      for (const claim of await this.storage.claimSynchronizations({
        batchSize: this.settings.batchSize,
        leaseMs: this.settings.leaseMs,
      })) {
        let success = false;
        try {
          await this.provider.getState(claim.account, { token: claim.token });
          success = true;
        } catch {
          /* Persist a safe retry schedule; pending hints continue fencing admission. */
        }
        await this.storage.completeSynchronization(claim, success);
      }
    };
    this.active = work().finally(() => {
      this.active = undefined;
    });
    return this.active;
  }
  start(options: { onError?: (code: 'recovery_unavailable') => void } = {}) {
    if (this.stopped) throw new BillingError('storage_unavailable');
    const ready = this.runOnce();
    if (!this.timer) {
      this.timer = setInterval(() => {
        void this.runOnce().catch(() => options.onError?.('recovery_unavailable'));
      }, this.settings.intervalMs);
      this.timer.unref();
    }
    return { ready, stop: () => this.stop() };
  }
  async stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.active?.catch(() => {});
  }
  metrics() {
    return this.storage.metrics();
  }
}
