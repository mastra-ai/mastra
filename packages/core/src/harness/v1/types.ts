import type { z } from 'zod';

import type { AgentExecutionOptionsBase } from '../../agent/agent.types';
import type { CreatedAgentSignal } from '../../agent/signals';
import type { ToolsInput } from '../../agent/types';
import type { GoalState, PendingResume, PermissionRules, SessionGrants } from '../../storage/domains/harness';
import type { MastraModelOutput, FullOutput } from '../../stream/base/output';
import type { HarnessMode } from './shared';

export type {
  AttachmentRecord,
  GoalJudgeDecision,
  GoalState,
  LoadedAttachment,
  PendingResume,
  PermissionRules,
  PersistedAttachment,
  QueuedItem,
  SessionGrants,
  SessionRecord,
  SessionSummary,
  SessionWorkspaceState,
  TokenUsage,
} from '../../storage/domains/harness';

export type PermissionPolicy = 'allow' | 'ask' | 'deny';

export interface ModelInfo {
  id: string;
  providerId: string;
  displayName?: string;
  contextWindow?: number;
  capabilities?: readonly string[];
  metadata?: Readonly<Record<string, unknown>>;
}

export type ModelAuthStatus = 'authenticated' | 'needs_auth' | 'unknown';

export interface HarnessSkill {
  name: string;
  description: string;
  instructions: string;
  category?: string;
  filePath?: string;
  metadata?: Record<string, unknown>;
}

export interface UseSkillOptions {
  args?: Record<string, unknown>;
  modelOverride?: string;
}

export type SessionLifecycleState = 'active' | 'closed' | 'evicted';

export interface HarnessLease {
  ownerId: string;
  acquiredAt: number;
  expiresAt: number;
  renewCount?: number;
}

export interface AttachmentRef {
  id: string;
  filename?: string;
  contentType?: string;
  url?: string;
}

export interface PendingBase {
  id: string;
  toolCallId: string;
  toolName?: string;
  runId?: string;
  signalId?: string;
  createdAt: number;
  expiresAt?: number;
}

export interface PendingApproval extends PendingBase {
  kind: 'tool-approval';
  args?: unknown;
  approved?: boolean;
}

export interface PendingToolSuspension extends PendingBase {
  kind: 'tool-suspension';
  suspendPayload?: unknown;
  resumeSchema?: unknown;
}

export interface PendingQuestion extends PendingBase {
  kind: 'question';
  question: string;
  options?: Array<{ label: string; description?: string }>;
  selectionMode?: 'single_select' | 'multi_select';
}

export interface PendingPlanApproval extends PendingBase {
  kind: 'plan-approval';
  planId: string;
  title: string;
  plan: string;
  transitionModeId?: string;
}

export interface PendingReceipt {
  id: string;
  sessionId: string;
  pendingId: string;
  kind: PendingResume['kind'];
  status: 'accepted' | 'duplicate' | 'stale' | 'not_found';
  createdAt: number;
}

export interface WorkspaceSessionBinding {
  providerId: string;
  workspaceId?: string;
  status: 'initializing' | 'ready' | 'destroying' | 'destroyed' | 'lost' | 'error';
  state?: unknown;
  metadata?: Record<string, unknown>;
}

export interface HarnessRunOperationalState {
  isBusy: boolean;
  runId?: string;
  traceId?: string;
  queuedItemId?: string;
  startedAt?: number;
  abortReason?: 'requested' | 'shutdown' | 'session_closed' | 'superseded';
}

export interface HarnessDisplayStateSnapshotV1<TState = unknown> {
  version: 1;
  sessionId: string;
  resourceId: string;
  threadId: string;
  modeId: string;
  modelId: string;
  state: TState;
  lifecycleState: SessionLifecycleState;
  operationalState: HarnessRunOperationalState;
  pendingResume?: PendingResume | null;
  pendingQueueDepth: number;
  goal?: GoalState | null;
  grants?: SessionGrants;
  permissionRules?: PermissionRules;
  updatedAt: number;
}

export interface ListPage<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number | false;
  hasMore: boolean;
}

interface SessionResolveCommon {
  parentSessionId?: string;
  origin?: 'top-level' | 'subagent-tool';
  modeId?: string;
  modelId?: string;
  subagentDepth?: number;
}

export interface SessionResolveByThread extends SessionResolveCommon {
  threadId: string | { fresh: true };
  resourceId: string;
  sessionId?: string;
}

export interface SessionResolveById extends SessionResolveCommon {
  sessionId: string;
  threadId?: never;
  resourceId?: never;
}

export interface SessionResolveByIdScoped extends SessionResolveCommon {
  sessionId: string;
  resourceId: string;
  threadId?: never;
}

export interface SessionResolveByResource extends SessionResolveCommon {
  resourceId: string;
  threadId?: never;
  sessionId?: never;
}

export type SessionResolveOptions =
  | SessionResolveByThread
  | SessionResolveById
  | SessionResolveByIdScoped
  | SessionResolveByResource;

export interface ThreadRecord {
  id: string;
  resourceId: string;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ThreadCreateOptions {
  resourceId: string;
  threadId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadListOptions {
  resourceId: string;
  perPage?: number | false;
  page?: number;
  orderBy?: { column: 'createdAt' | 'updatedAt'; direction: 'ASC' | 'DESC' };
  metadata?: Record<string, unknown>;
}

export type ThreadListResult = ListPage<ThreadRecord> & { threads: ThreadRecord[] };

export interface ThreadGetOptions {
  resourceId: string;
  threadId: string;
}

export interface ThreadRenameOptions extends ThreadGetOptions {
  title: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadCloneOptions extends ThreadGetOptions {
  newThreadId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  messageLimit?: number;
}

export interface ThreadSelectOrCreateOptions {
  resourceId: string;
  threadId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

export interface ThreadDeleteOptions extends ThreadGetOptions {}

export interface ThreadSetSettingsOptions extends ThreadGetOptions {
  patch: Record<string, unknown>;
}

export interface ThreadGetSettingsOptions extends ThreadGetOptions {}

export interface ThreadGetSettingOptions extends ThreadGetOptions {
  key: string;
}

export interface SessionListOptions {
  resourceId: string;
  includeClosed?: boolean;
}

export interface SessionLoadByIdOptions {
  sessionId: string;
  includeClosed?: boolean;
}

export interface AttachmentUploadOptions {
  resourceId: string;
  data: Buffer | ReadableStream<Uint8Array>;
  filename: string;
  contentType: string;
}

export interface AttachmentDeleteOptions {
  attachmentId: string;
  resourceId: string;
}

export interface ShutdownOptions {
  drainTimeoutMs?: number;
}

export interface MessageOverrides {
  model?: string;
  mode?: string;
  additionalTools?: ToolsInput;
}

interface MessageOptionsBase extends MessageOverrides {
  content: string;
  attachments?: AttachmentRef[];
  abortSignal?: AbortSignal;
}

export interface MessageOptionsDefault extends MessageOptionsBase {
  stream?: false;
  output?: undefined;
  sync?: undefined;
}

export interface MessageOptionsStream extends MessageOptionsBase {
  stream: true;
  output?: undefined;
  sync?: undefined;
}

export interface MessageOptionsStructured<S extends z.ZodTypeAny> extends MessageOptionsBase {
  output: S;
  sync: true;
  stream?: false;
}

export type MessageOptions<S extends z.ZodTypeAny = z.ZodTypeAny> =
  | MessageOptionsDefault
  | MessageOptionsStream
  | MessageOptionsStructured<S>;

export type AgentResult<OUTPUT = undefined> = FullOutput<OUTPUT>;
export type AgentStream<OUTPUT = undefined> = MastraModelOutput<OUTPUT>;

export interface QueueOverrides {
  model?: string;
  mode?: string;
  yolo?: boolean;
}

export interface QueueOptions extends QueueOverrides {
  content: string;
  attachments?: AttachmentRef[];
}

export interface ListMessagesOptions {
  limit?: number;
}

export interface SessionSignalOptions {
  content: string;
  mode?: string;
  additionalTools?: ToolsInput;
  abortSignal?: AbortSignal;
}

export interface SessionSignalResult {
  id: string;
  runId: string;
  willInterleave: boolean;
  accepted: true;
  signal: CreatedAgentSignal;
  result: Promise<AgentResult>;
}

export interface SessionInjectSystemReminderOptions {
  attributes?: Record<string, string | number | boolean | null | undefined>;
  metadata?: Record<string, unknown>;
}

export interface SessionInjectSystemReminderResult {
  id: string;
  runId: string;
  willInterleave: boolean;
  accepted: true;
  signal: CreatedAgentSignal;
}

export type RawAgentExecutionOptions<OUTPUT = unknown> = AgentExecutionOptionsBase<OUTPUT>;

export interface GoalOptions {
  objective: string;
  judgeModel?: string;
  maxTurns?: number;
  kickoff?: boolean;
}

export interface SubagentDefinition {
  agentId: string;
  modeId?: string;
  description: string;
  defaultModelId?: string;
  tools?: ToolsInput;
  workspace?: 'inherit' | 'fresh';
  metadata?: Record<string, unknown>;
}

export type EffectiveHarnessMode<TState = unknown> = HarnessMode<TState>;
