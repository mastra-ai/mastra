import type { BackgroundTask } from '../../background-tasks/types';
import type { ScoreRowData } from '../../evals/types';
import type { StorageThreadType } from '../../memory/types';
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
  ObservationalMemoryRecord,
  DatasetRecord,
  DatasetItemRow,
  DatasetVersion,
  Experiment,
  ExperimentResult,
} from '../types';
import type { AgentVersion } from './agents';
import type {
  KnowledgeActivityEvent,
  KnowledgeCurationCursor,
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgePage,
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
import type { WorkspaceVersion } from './workspaces';

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
  readonly knowledgeEntities = new Map<string, KnowledgeEntity>();
  readonly knowledgeEntityKeys = new Map<string, string>();
  readonly knowledgePages = new Map<string, KnowledgePage>();
  readonly knowledgePageKeys = new Map<string, string>();
  readonly knowledgeFacts = new Map<string, KnowledgeFact>();
  readonly knowledgeMentions = new Map<string, Set<string>>();
  readonly knowledgeCursors = new Map<string, KnowledgeCurationCursor>();
  readonly knowledgeActivity: KnowledgeActivityEvent[] = [];
  readonly knowledgeSemanticOutbox = new Map<string, KnowledgeSemanticOutboxEntry>();
  readonly knowledgeSemanticIdempotency = new Map<string, string>();

  // Schedules domain
  readonly schedules = new Map<string, Schedule>();
  readonly scheduleTriggers: ScheduleTrigger[] = [];

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
    this.datasets.clear();
    this.datasetItems.clear();
    this.datasetVersions.clear();
    this.experiments.clear();
    this.experimentResults.clear();
    this.backgroundTasks.clear();
    this.knowledgeEntities.clear();
    this.knowledgeEntityKeys.clear();
    this.knowledgePages.clear();
    this.knowledgePageKeys.clear();
    this.knowledgeFacts.clear();
    this.knowledgeMentions.clear();
    this.knowledgeCursors.clear();
    this.knowledgeActivity.length = 0;
    this.knowledgeSemanticOutbox.clear();
    this.knowledgeSemanticIdempotency.clear();
    this.schedules.clear();
    this.scheduleTriggers.length = 0;
    this.toolProviderConnections.clear();
  }
}
