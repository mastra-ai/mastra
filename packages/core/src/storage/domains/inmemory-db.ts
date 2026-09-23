import type { BackgroundTask } from '../../background-tasks/types';
import type { ScoreRowData } from '../../evals/types';
import type { StorageThreadType } from '../../memory/types';
import type {
  WorkflowTerminalEffectRecord,
  WorkflowTerminalDestinationReceiptRecord,
  WorkflowTerminalizationRecord,
  WorkflowTerminalSnapshotRecord,
} from '../../workflows';
import type {
  StorageAgentType,
  StorageMCPClientType,
  StorageMCPServerType,
  StorageMessageType,
  StoragePromptBlockType,
  StorageResourceType,
  StorageScorerDefinitionType,
  StorageFavoriteType,
  StorageWorkspaceType,
  StorageSkillType,
  StorageToolProviderConnection,
  StorageWorkflowRun,
  WorkflowTerminalContinuationPlanRecord,
  WorkflowTerminalRecoveryAncestryRecord,
  WorkflowSnapshotHandoffRecord,
  ObservationalMemoryRecord,
  DatasetRecord,
  DatasetItemRow,
  DatasetVersion,
  Experiment,
  ExperimentResult,
} from '../types';
import type { AgentVersion } from './agents';
import type {
  AgentSignalResultEvidence,
  AttachmentRecord,
  AttachmentReference,
  ChannelActionReceipt,
  ChannelActionToken,
  ChannelBinding,
  ChannelInboxItem,
  ChannelOutboxItem,
  HarnessPlanTask,
  HarnessRunSummary,
  HarnessProviderCallbackBinding,
  HarnessWakeupItem,
  HarnessSessionEventRecord,
  HarnessSessionRecordProjectionFence,
  HarnessSessionRecordProjectionIntent,
  WorkspaceActionJournalEntry,
  OperationAdmissionTombstone,
  SessionRecord,
} from './harness/types';
import type {
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeRecord,
  KnowledgeNode,
  KnowledgeSemanticOutboxEntry,
} from './knowledge';
import type { MCPClientVersion } from './mcp-clients';
import type { MCPServerVersion } from './mcp-servers';
import type { TraceEntry } from './observability';
import type { FeedbackRecord } from './observability/feedback';
import type { LogRecord } from './observability/logs';
import type { MetricRecord } from './observability/metrics';
import type { ScoreRecord } from './observability/scores';
import type { PromptBlockVersion } from './prompt-blocks';
import type { Schedule, ScheduleTrigger } from './schedules/base';
import type { ScorerDefinitionVersion } from './scorer-definitions';
import type { SkillVersion } from './skills';
import type { WorkflowDefinition } from './workflow-definitions';
import type { WorkspaceVersion } from './workspaces';

export interface WorkflowTerminalParentRevisionState {
  generation: number;
  terminalStatus: 'success' | 'failed' | 'canceled' | 'tripwire' | 'bailed' | 'skipped' | null;
}

class WorkflowTerminalDestinationReceiptMap extends Map<string, WorkflowTerminalDestinationReceiptRecord> {
  readonly #physicalKeysByEffect = new Map<string, Set<string>>();
  readonly #physicalKeysByLogicalEffect = new Map<string, Set<string>>();
  readonly #physicalKeysByEffectConsumer = new Map<string, Set<string>>();
  readonly #physicalKeysByLogicalConsumer = new Map<string, Set<string>>();

  #effectKey(receipt: WorkflowTerminalDestinationReceiptRecord): string {
    return JSON.stringify([receipt.effectKey]);
  }

  #logicalEffectKey(receipt: WorkflowTerminalDestinationReceiptRecord): string {
    return JSON.stringify([receipt.workflowName, receipt.runId, receipt.effectKind]);
  }

  #effectConsumerKey(receipt: WorkflowTerminalDestinationReceiptRecord): string {
    return JSON.stringify([receipt.effectKey, receipt.consumerId]);
  }

  #logicalConsumerKey(receipt: WorkflowTerminalDestinationReceiptRecord): string {
    return JSON.stringify([receipt.workflowName, receipt.runId, receipt.effectKind, receipt.consumerId]);
  }

  #add(index: Map<string, Set<string>>, indexKey: string, physicalKey: string): void {
    const keys = index.get(indexKey) ?? new Set<string>();
    keys.add(physicalKey);
    index.set(indexKey, keys);
  }

  #remove(index: Map<string, Set<string>>, indexKey: string, physicalKey: string): void {
    const keys = index.get(indexKey);
    if (!keys) return;
    keys.delete(physicalKey);
    if (keys.size === 0) index.delete(indexKey);
  }

  #index(physicalKey: string, receipt: WorkflowTerminalDestinationReceiptRecord): void {
    this.#add(this.#physicalKeysByEffect, this.#effectKey(receipt), physicalKey);
    this.#add(this.#physicalKeysByLogicalEffect, this.#logicalEffectKey(receipt), physicalKey);
    this.#add(this.#physicalKeysByEffectConsumer, this.#effectConsumerKey(receipt), physicalKey);
    this.#add(this.#physicalKeysByLogicalConsumer, this.#logicalConsumerKey(receipt), physicalKey);
  }

  #deindex(physicalKey: string, receipt: WorkflowTerminalDestinationReceiptRecord): void {
    this.#remove(this.#physicalKeysByEffect, this.#effectKey(receipt), physicalKey);
    this.#remove(this.#physicalKeysByLogicalEffect, this.#logicalEffectKey(receipt), physicalKey);
    this.#remove(this.#physicalKeysByEffectConsumer, this.#effectConsumerKey(receipt), physicalKey);
    this.#remove(this.#physicalKeysByLogicalConsumer, this.#logicalConsumerKey(receipt), physicalKey);
  }

  override set(physicalKey: string, receipt: WorkflowTerminalDestinationReceiptRecord): this {
    const existing = this.get(physicalKey);
    if (existing) this.#deindex(physicalKey, existing);
    super.set(physicalKey, receipt);
    this.#index(physicalKey, receipt);
    return this;
  }

  override delete(physicalKey: string): boolean {
    const existing = this.get(physicalKey);
    const deleted = super.delete(physicalKey);
    if (deleted && existing) this.#deindex(physicalKey, existing);
    return deleted;
  }

  override clear(): void {
    super.clear();
    this.#physicalKeysByEffect.clear();
    this.#physicalKeysByLogicalEffect.clear();
    this.#physicalKeysByEffectConsumer.clear();
    this.#physicalKeysByLogicalConsumer.clear();
  }

  findMatches(effect: WorkflowTerminalEffectRecord, consumerId: string): WorkflowTerminalDestinationReceiptRecord[] {
    const physicalKeys = new Set<string>([
      JSON.stringify([effect.effectKey, consumerId]),
      ...(this.#physicalKeysByEffectConsumer.get(JSON.stringify([effect.effectKey, consumerId])) ?? []),
      ...(this.#physicalKeysByLogicalConsumer.get(
        JSON.stringify([effect.workflowName, effect.runId, effect.kind, consumerId]),
      ) ?? []),
    ]);
    return [...physicalKeys].flatMap(physicalKey => {
      const receipt = this.get(physicalKey);
      return receipt ? [receipt] : [];
    });
  }

  countForEffect(effect: WorkflowTerminalEffectRecord): number {
    return new Set([
      ...(this.#physicalKeysByEffect.get(JSON.stringify([effect.effectKey])) ?? []),
      ...(this.#physicalKeysByLogicalEffect.get(JSON.stringify([effect.workflowName, effect.runId, effect.kind])) ??
        []),
    ]).size;
  }
}

/**
 * InMemoryDB is a thin database layer for in-memory storage.
 * It holds all the Maps that store data, similar to how a real database
 * connection (pg-promise client, libsql client) is shared across domains.
 *
 * Each domain receives a reference to this db and operates on the relevant Maps.
 */
export class InMemoryDB {
  readonly threads = new Map<string, StorageThreadType>();
  readonly messages = new Map<string, StorageMessageType>();
  readonly resources = new Map<string, StorageResourceType>();
  readonly workflows = new Map<string, StorageWorkflowRun>();
  /** Terminal workflow-event coordination, isolated from replaceable workflow snapshots. */
  readonly workflowTerminalizations = new Map<string, WorkflowTerminalizationRecord>();
  /** Immutable terminal producer intents, isolated from workflow snapshots and journal claims. */
  readonly workflowTerminalEffects = new Map<string, WorkflowTerminalEffectRecord>();
  /** Immutable terminal state retained while terminal protocol evidence remains incomplete. */
  readonly workflowTerminalSnapshots = new Map<string, WorkflowTerminalSnapshotRecord>();
  /** Immutable ancestry captured before a nested child begins execution. */
  readonly workflowTerminalRecoveryAncestries = new Map<string, WorkflowTerminalRecoveryAncestryRecord>();
  /** Consumer-scoped destination receipt evidence, isolated from replaceable workflow runs. */
  readonly workflowTerminalDestinationReceipts = new WorkflowTerminalDestinationReceiptMap();
  /** Immutable continuation plans keyed by their canonical receipt identity. */
  readonly workflowTerminalContinuationPlans = new Map<string, WorkflowTerminalContinuationPlanRecord>();
  /** Opaque monotonic revisions plus an immutable terminal-status latch for parent recovery. */
  readonly workflowTerminalParentRevisions = new Map<string, WorkflowTerminalParentRevisionState>();
  /** Framework-owned product snapshot handoff records and mutation fences. */
  readonly workflowSnapshotHandoffs = new Map<string, WorkflowSnapshotHandoffRecord>();
  readonly workflowDefinitions = new Map<string, WorkflowDefinition>();
  readonly scores = new Map<string, ScoreRowData>();
  readonly traces = new Map<string, TraceEntry>();
  readonly metricRecords: MetricRecord[] = [];
  readonly logRecords: LogRecord[] = [];
  readonly scoreRecords: ScoreRecord[] = [];
  readonly feedbackRecords: FeedbackRecord[] = [];
  observabilityNextCursorId = 1;
  readonly traceCursorIds = new Map<string, number>();
  readonly branchCursorIds = new Map<string, number>();
  readonly metricCursorIds = new Map<MetricRecord, number>();
  readonly logCursorIds = new Map<LogRecord, number>();
  readonly scoreCursorIds = new Map<ScoreRecord, number>();
  readonly feedbackCursorIds = new Map<FeedbackRecord, number>();
  readonly agents = new Map<string, StorageAgentType>();
  readonly agentVersions = new Map<string, AgentVersion>();
  readonly promptBlocks = new Map<string, StoragePromptBlockType>();
  readonly promptBlockVersions = new Map<string, PromptBlockVersion>();
  readonly scorerDefinitions = new Map<string, StorageScorerDefinitionType>();
  readonly scorerDefinitionVersions = new Map<string, ScorerDefinitionVersion>();
  readonly mcpClients = new Map<string, StorageMCPClientType>();
  readonly mcpClientVersions = new Map<string, MCPClientVersion>();
  readonly mcpServers = new Map<string, StorageMCPServerType>();
  readonly mcpServerVersions = new Map<string, MCPServerVersion>();
  readonly workspaces = new Map<string, StorageWorkspaceType>();
  readonly workspaceVersions = new Map<string, WorkspaceVersion>();
  readonly skills = new Map<string, StorageSkillType>();
  readonly skillVersions = new Map<string, SkillVersion>();
  /**
   * Favorites keyed by `${userId}\u0000${entityType}\u0000${entityId}`. The
   * favorites domain owns reads/writes; this Map lives on InMemoryDB so the
   * favorites domain can also mutate `agents` / `skills` `favoriteCount` atomically
   * within the same synchronous block.
   */
  readonly favorites = new Map<string, StorageFavoriteType>();
  /** Observational memory records, keyed by resourceId, each holding array of records (generations) */
  readonly observationalMemory = new Map<string, ObservationalMemoryRecord[]>();
  /** Storage-private generations used by conditional thread-clone rollback. */
  readonly memoryThreadGenerations = new Map<string, string>();
  /** Storage-private generations used by conditional cloned-OM rollback. */
  readonly memoryObservationalGenerations = new Map<string, string>();

  // Dataset domain maps
  readonly datasets = new Map<string, DatasetRecord>();
  readonly datasetItems = new Map<string, DatasetItemRow[]>();
  readonly datasetVersions = new Map<string, DatasetVersion>();

  // Experiment domain maps
  readonly experiments = new Map<string, Experiment>();
  readonly experimentResults = new Map<string, ExperimentResult>();

  // Background tasks domain
  readonly backgroundTasks = new Map<string, BackgroundTask>();

  // Knowledge domain
  readonly knowledgeNodes = new Map<string, KnowledgeNode>();
  readonly knowledgeNodeKeys = new Map<string, string>();
  readonly knowledgeRecords = new Map<string, KnowledgeRecord>();
  readonly knowledgeMentions = new Map<string, Set<string>>();
  readonly knowledgeCursors = new Map<string, KnowledgeCurationCursor>();
  readonly knowledgeActivity: KnowledgeActivityEvent[] = [];
  readonly knowledgeSemanticOutbox = new Map<string, KnowledgeSemanticOutboxEntry>();
  readonly knowledgeSemanticIdempotency = new Map<string, string>();

  // Schedules domain
  readonly schedules = new Map<string, Schedule>();
  readonly scheduleTriggers: ScheduleTrigger[] = [];

  // Harness domain — see HARNESS_V1_SPEC.md §5.
  readonly harnessSessions = new Map<string, SessionRecord>();
  readonly harnessAttachmentRecords = new Map<string, AttachmentRecord>();
  readonly harnessAttachmentBytes = new Map<string, Uint8Array>();
  readonly harnessAttachmentReferences = new Map<string, AttachmentReference>();
  readonly harnessMessageResultEvidence = new Map<string, AgentSignalResultEvidence>();
  readonly harnessOperationTombstones = new Map<string, OperationAdmissionTombstone>();
  readonly harnessSessionEvents = new Map<string, HarnessSessionEventRecord>();
  readonly harnessSessionRecordProjectionIntents = new Map<string, HarnessSessionRecordProjectionIntent>();
  readonly harnessSessionRecordProjectionFences = new Map<string, HarnessSessionRecordProjectionFence>();
  readonly harnessWorkspaceActionJournal = new Map<string, WorkspaceActionJournalEntry>();
  readonly harnessChannelBindings = new Map<string, ChannelBinding>();
  readonly harnessChannelInbox = new Map<string, ChannelInboxItem>();
  readonly harnessProviderCallbackBindings = new Map<string, HarnessProviderCallbackBinding>();
  readonly harnessChannelActionTokens = new Map<string, ChannelActionToken>();
  readonly harnessChannelActionReceipts = new Map<string, ChannelActionReceipt>();
  readonly harnessChannelOutbox = new Map<string, ChannelOutboxItem>();
  readonly harnessWakeupItems = new Map<string, HarnessWakeupItem>();
  readonly harnessPlanTasks = new Map<string, HarnessPlanTask>();
  /** Span-summary durable run history, keyed by `${harnessName}::${runId}`. */
  readonly harnessRunSummaries = new Map<string, HarnessRunSummary>();
  readonly harnessThreadDeleteFences = new Map<
    string,
    { threadId: string; ownerId: string; leaseId: string; createdAt: number; expiresAt: number }
  >();

  /**
   * Tool provider connections keyed by `${authorId}\u0000${providerId}\u0000${connectionId}`.
   */
  readonly toolProviderConnections = new Map<string, StorageToolProviderConnection>();

  /**
   * Clears all data from all collections.
   * Useful for testing.
   */
  clear(): void {
    this.threads.clear();
    this.messages.clear();
    this.resources.clear();
    this.workflows.clear();
    this.workflowTerminalizations.clear();
    this.workflowTerminalEffects.clear();
    this.workflowTerminalSnapshots.clear();
    this.workflowTerminalRecoveryAncestries.clear();
    this.workflowTerminalDestinationReceipts.clear();
    this.workflowTerminalContinuationPlans.clear();
    this.workflowTerminalParentRevisions.clear();
    this.workflowSnapshotHandoffs.clear();
    this.workflowDefinitions.clear();
    this.scores.clear();
    this.traces.clear();
    this.metricRecords.length = 0;
    this.logRecords.length = 0;
    this.scoreRecords.length = 0;
    this.feedbackRecords.length = 0;
    this.observabilityNextCursorId = 1;
    this.traceCursorIds.clear();
    this.branchCursorIds.clear();
    this.metricCursorIds.clear();
    this.logCursorIds.clear();
    this.scoreCursorIds.clear();
    this.feedbackCursorIds.clear();
    this.agents.clear();
    this.agentVersions.clear();
    this.promptBlocks.clear();
    this.promptBlockVersions.clear();
    this.scorerDefinitions.clear();
    this.scorerDefinitionVersions.clear();
    this.mcpClients.clear();
    this.mcpClientVersions.clear();
    this.mcpServers.clear();
    this.mcpServerVersions.clear();
    this.workspaces.clear();
    this.workspaceVersions.clear();
    this.skills.clear();
    this.skillVersions.clear();
    this.favorites.clear();
    this.observationalMemory.clear();
    this.memoryThreadGenerations.clear();
    this.memoryObservationalGenerations.clear();
    this.datasets.clear();
    this.datasetItems.clear();
    this.datasetVersions.clear();
    this.experiments.clear();
    this.experimentResults.clear();
    this.backgroundTasks.clear();
    this.knowledgeNodes.clear();
    this.knowledgeNodeKeys.clear();
    this.knowledgeRecords.clear();
    this.knowledgeMentions.clear();
    this.knowledgeCursors.clear();
    this.knowledgeActivity.length = 0;
    this.knowledgeSemanticOutbox.clear();
    this.knowledgeSemanticIdempotency.clear();
    this.schedules.clear();
    this.scheduleTriggers.length = 0;
    this.harnessSessions.clear();
    this.harnessAttachmentRecords.clear();
    this.harnessAttachmentBytes.clear();
    this.harnessAttachmentReferences.clear();
    this.harnessMessageResultEvidence.clear();
    this.harnessOperationTombstones.clear();
    this.harnessSessionEvents.clear();
    this.harnessSessionRecordProjectionIntents.clear();
    this.harnessSessionRecordProjectionFences.clear();
    this.harnessWorkspaceActionJournal.clear();
    this.harnessChannelBindings.clear();
    this.harnessChannelInbox.clear();
    this.harnessProviderCallbackBindings.clear();
    this.harnessChannelActionTokens.clear();
    this.harnessChannelActionReceipts.clear();
    this.harnessChannelOutbox.clear();
    this.harnessWakeupItems.clear();
    this.harnessPlanTasks.clear();
    this.harnessRunSummaries.clear();
    this.harnessThreadDeleteFences.clear();
    this.toolProviderConnections.clear();
  }
}
