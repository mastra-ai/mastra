import type { MastraMemory } from '../../memory';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
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
  subagentModelId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  messageLimit?: number;
};

export interface SessionConfig<TState = {}> {
  memory: MastraMemory | DynamicArgument<MastraMemory>;
  events: EventEmitter;
  getState?: () => Readonly<TState>;
  setState?: (updates: Partial<TState>) => Promise<void>;
  updateState?: <TResult>(
    updater: (
      state: Readonly<TState>,
    ) =>
      | { updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }
      | Promise<{ updates?: Partial<TState>; events?: Parameters<EventEmitter['emit']>[0][]; result: TResult }>,
  ) => Promise<TResult>;
  workspace?: Workspace;
  workspaceFn?: Extract<DynamicArgument<Workspace | undefined>, (...args: any[]) => any>;
  setWorkspace?: (workspace: Workspace | undefined) => void;
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
  subagentModelId?: string;
  mode: HarnessMode;
  createdAt: Date;
  lastActivityAt: Date;
}

export type { SessionRecord } from '../../storage/domains/harness';
