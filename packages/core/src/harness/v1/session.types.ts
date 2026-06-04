import type { MastraMemory } from '../../memory';
import type { DynamicArgument } from '../../types';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';

export type CloneSessionOptions = {
  sessionId?: string;
  threadId?: string;
  resourceId?: string;
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  mode?: HarnessMode;
  modelId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  messageLimit?: number;
};

export interface SessionConfig {
  memory: MastraMemory | DynamicArgument<MastraMemory>;
  events: EventEmitter;
  // storage: HarnessStorage;
  /** Identifier of the Harness instance that owns this session. */
  ownerId: string;
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
  lastActivityAt: Date;
}

export type { SessionRecord } from '../../storage/domains/harness';
