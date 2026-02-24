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
  StorageWorkspaceType,
  StorageSkillType,
  StorageWorkflowRun,
  ObservationalMemoryRecord,
  DatasetRecord,
  DatasetItemRow,
  DatasetVersion,
  Experiment,
  ExperimentResult,
} from '../types';
import type { AgentVersion } from './agents';
import type { MCPClientVersion } from './mcp-clients';
import type { MCPServerVersion } from './mcp-servers';
import type { TraceEntry } from './observability';
import type { PromptBlockVersion } from './prompt-blocks';
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
  /** Observational memory records, keyed by resourceId, each holding array of records (generations) */
  readonly observationalMemory = new Map<string, ObservationalMemoryRecord[]>();

  // Dataset domain maps
  readonly datasets = new Map<string, DatasetRecord>();
  readonly datasetItems = new Map<string, DatasetItemRow[]>();
  readonly datasetVersions = new Map<string, DatasetVersion>();

  // Experiment domain maps
  readonly experiments = new Map<string, Experiment>();
  readonly experimentResults = new Map<string, ExperimentResult>();

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
    this.observationalMemory.clear();
    this.datasets.clear();
    this.datasetItems.clear();
    this.datasetVersions.clear();
    this.experiments.clear();
    this.experimentResults.clear();
  }
}
