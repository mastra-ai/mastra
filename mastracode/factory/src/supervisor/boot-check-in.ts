import type { FactoryRules } from '../rules/types.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

/**
 * How long one enqueued check-in suppresses the next. `mastra dev` restarts on
 * every file save, so without this the supervisor would burn a model turn per
 * keystroke-save; the window also collapses a fleet-wide rolling restart into a
 * single wake.
 */
export const FACTORY_BOOT_CHECK_IN_COOLDOWN_MS = 15 * 60 * 1_000;

export interface FactoryBootCheckInOptions {
  storage: Pick<WorkItemsStorage, 'listTenantsWithOpenWorkItems' | 'createBootCheckInNotification'>;
  audit: Pick<AuditStorage, 'record'>;
  rules: FactoryRules;
  cooldownMs?: number;
  now?(): Date;
  onError?(error: unknown): void;
}

export interface FactoryBootCheckInResult {
  enqueued: number;
  skipped: number;
}

/**
 * Enqueue a durable "the server just restarted, check on ongoing work" wake for
 * every tenant that still has non-terminal work.
 *
 * This is the only signal that covers runs killed by the restart: they never
 * emit an `agent_end`, so `FactoryRunLifecycleObserver` cannot observe them.
 * The rows land in the same table the dispatcher already leases, which is what
 * makes delivery exactly-once across replicas.
 */
export class FactoryBootCheckIn {
  readonly #options: FactoryBootCheckInOptions;

  constructor(options: FactoryBootCheckInOptions) {
    this.#options = options;
  }

  async run(): Promise<FactoryBootCheckInResult> {
    if (this.#options.rules.supervisor?.checkInOnBoot === false) return { enqueued: 0, skipped: 0 };

    const now = this.#options.now?.() ?? new Date();
    const cooldownMs = this.#options.cooldownMs ?? FACTORY_BOOT_CHECK_IN_COOLDOWN_MS;
    // Bucketing the key (rather than reading the last check-in) keeps the
    // dedupe decision in the unique index, so concurrently booting replicas
    // cannot both win.
    const bucketKey = String(Math.floor(now.getTime() / cooldownMs));

    const tenants = await this.#options.storage.listTenantsWithOpenWorkItems();
    let enqueued = 0;
    let skipped = 0;
    for (const tenant of tenants) {
      try {
        const record = await this.#options.storage.createBootCheckInNotification({
          orgId: tenant.orgId,
          factoryProjectId: tenant.factoryProjectId,
          supervisorUserId: tenant.supervisorUserId,
          bucketKey,
          reason: 'The Factory server restarted while work was open.',
          summary:
            `The Factory server restarted. ${tenant.openItemCount} work item(s) are still open, and any runs that ` +
            `were in flight were killed without finishing. Check which items are stalled and nudge, cancel, or ` +
            `escalate them one at a time.`,
          now,
        });
        if (!record) {
          skipped += 1;
          continue;
        }
        enqueued += 1;
        await this.#options.audit.record({
          orgId: tenant.orgId,
          actorId: 'system:factory-boot',
          actorType: 'agent',
          action: 'factory.supervisor.boot_check_in',
          targets: [{ type: 'factory_project', id: tenant.factoryProjectId }],
          metadata: { openItemCount: tenant.openItemCount, notificationId: record.id },
          factoryProjectId: tenant.factoryProjectId,
        });
      } catch (error) {
        // A boot-time advisory must never take the server down with it.
        this.#options.onError?.(error);
      }
    }
    return { enqueued, skipped };
  }
}
