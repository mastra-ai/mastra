import type { HarnessMode } from './mode';

export interface SessionConfig {
  // harness: Harness;
  // storage: HarnessStorage;
  // ownerId: string;
  /** Initial record loaded under the lease. The Session takes ownership. */
  // record: SessionRecord;
  /** Lease TTL the Harness acquired the lease for. */
  // leaseExpiresAt: number;
  /** Durable event replay cursor seed from the previous live owner, if any. */
  // eventReplaySeed?: { epoch: string; nextSequence: number };
  id: string;
  resourceId: string;
  threadId: string;
  model: string;
  mode: HarnessMode;
  createdAt: Date;
}

export type { SessionRecord } from '../../storage/domains/harness';
