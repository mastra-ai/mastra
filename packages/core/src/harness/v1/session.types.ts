import type { MastraMemory } from '../../memory';
import type { PublicSchema } from '../../schema';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
import type { Skill } from '../../workspace/skills/types';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';
import type { PermissionPolicy, ToolCategoryResolver } from './permissions.types';
import type { ModelResolver, SubagentRegistryConfig } from './subagents.types';

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

export interface SessionConfig<TState = {}> {
  memory: MastraMemory | DynamicArgument<MastraMemory>;
  events: EventEmitter;
  stateSchema?: PublicSchema<TState>;
  initialState?: Partial<TState>;
  workspace?: DynamicArgument<Workspace | undefined>;
  /** Explicitly configured canonical skills exposed to this session. */
  skills?: readonly Skill[];
  /** Subagent registry the session can spawn through the built-in tool. */
  subagents?: SubagentRegistryConfig;
  /** Resolves a model id to a `LanguageModel`. Required for subagent spawn. */
  resolveModel?: ModelResolver;
  /** Default permission policy applied when no category rule matches. */
  defaultPermissionPolicy?: PermissionPolicy;
  /** Resolves a tool name to its category for permission-gate evaluation. */
  toolCategoryResolver?: ToolCategoryResolver;
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
