import type {
  Agent,
  AgentExecutionOptionsBase,
  AgentMessageInput,
  AgentSubscribeToThreadOptions,
  AgentThreadSubscription,
  QueueAgentMessageOptions,
  QueueAgentMessageResult,
  SendAgentMessageOptions,
  SendAgentMessageResult,
} from '../../agent';
import type { MessageListInput } from '../../agent/message-list';
import type { MastraModelGatewayInterface } from '../../llm';
import type { MastraMemory } from '../../memory';
import type { PublicSchema } from '../../schema';
import type { HarnessPendingItemRecord, HarnessStorage, SessionRecord } from '../../storage/domains/harness';
import type { DynamicArgument } from '../../types';
import type { Workspace } from '../../workspace';
import type { EventEmitter } from './events';
import type { HarnessMode } from './mode';
import type {
  PermissionPolicy,
  PermissionRequestedCallback,
  PermissionRules,
  SessionGrant,
  ToolCategoryResolver,
} from './permissions.types';
import type { SubagentRegistryConfig } from './subagents.types';

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

export type HarnessAgentResolver = (agentId: string) => Agent | Promise<Agent>;
export type HarnessModeResolver = (modeId: string) => HarnessMode | Promise<HarnessMode>;

type SessionScopedMessageOptions<OUTPUT = unknown> = Omit<
  Extract<SendAgentMessageOptions<OUTPUT>, { resourceId: string; threadId: string }>,
  'resourceId' | 'threadId' | 'ifIdle'
> & {
  ifIdle?: Omit<
    NonNullable<Extract<SendAgentMessageOptions<OUTPUT>, { resourceId: string; threadId: string }>['ifIdle']>,
    'streamOptions'
  > & {
    streamOptions?: Omit<AgentExecutionOptionsBase<OUTPUT>, 'requestContext' | 'toolsets' | 'model'>;
  };
};

export type SessionSubscribeToThreadOptions = Omit<AgentSubscribeToThreadOptions, 'resourceId' | 'threadId'>;
export type SessionThreadSubscription<OUTPUT = unknown> = AgentThreadSubscription<OUTPUT>;
export type SessionSendMessageResult = SendAgentMessageResult;
export type SessionQueueMessageResult = QueueAgentMessageResult;
export type SessionQueueMessageOptions<OUTPUT = unknown> = Omit<
  Extract<QueueAgentMessageOptions<OUTPUT>, { resourceId: string; threadId: string }>,
  'resourceId' | 'threadId' | 'ifIdle'
> &
  Pick<SessionScopedMessageOptions<OUTPUT>, 'ifIdle'>;

export type SessionMessageInput = AgentMessageInput | MessageListInput;
export type SessionMessageOptions<OUTPUT = unknown> = Omit<
  AgentExecutionOptionsBase<OUTPUT>,
  'requestContext' | 'toolsets' | 'model'
> &
  SessionScopedMessageOptions<OUTPUT> & {
    messages: SessionMessageInput;
  };

export interface SessionConfig<TState = {}> {
  memory: MastraMemory | DynamicArgument<MastraMemory>;
  events: EventEmitter;
  stateSchema?: PublicSchema<TState>;
  initialState?: Partial<TState>;
  workspace?: DynamicArgument<Workspace | undefined>;
  agent: Agent;
  /** Subagent registry the session can spawn through the built-in tool. */
  subagents?: SubagentRegistryConfig;
  /**  */
  gateways: Array<MastraModelGatewayInterface>;
  /** Default permission policy applied when no category rule matches. */
  defaultPermissionPolicy?: PermissionPolicy;
  /** Session permission rules layered above the default policy. */
  permissionRules?: PermissionRules;
  /** Initial session grants that suppress policy-driven approval prompts. */
  sessionGrants?: readonly SessionGrant[];
  /** Called whenever a permission gate creates a pending approval. */
  onPermissionRequested?: PermissionRequestedCallback;
  /** Resolves a tool name to its category for permission-gate evaluation. */
  toolCategoryResolver?: ToolCategoryResolver;
  storage: HarnessStorage;
  /** Initial durable record loaded under the session lease. */
  record?: SessionRecord;
  /** Runtime compatibility generation snapshotted on recoverable work. */
  runtimeCompatibilityGeneration?: string | null;
  /** Initial ordered pending records loaded from the durable record. */
  pending?: HarnessPendingItemRecord[];
  /** Resolves the mode's backing agent without exposing the registry publicly. */
  resolveAgent?: HarnessAgentResolver;
  /** Resolves modes for session-owned transitions without exposing the registry publicly. */
  resolveMode?: HarnessModeResolver;
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
