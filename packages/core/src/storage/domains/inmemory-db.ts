import type { ScoreRowData } from '../../evals/types';
import type { StorageThreadType } from '../../memory/types';
import type {
  StorageAgentType,
  StorageMessageType,
  StorageResourceType,
  StorageWorkflowRun,
  StorageIntegrationConfig,
  StorageCachedTool,
  StorageWorkflowDefinitionType,
  StoredScorerType,
  StoredScorerVersionType,
} from '../types';
import type { AgentVersion } from './agents/base';
import type { TraceEntry } from './observability';
import type { WorkflowDefinitionVersion } from './workflow-definitions/base';

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
  readonly integrations = new Map<string, StorageIntegrationConfig>();
  readonly cachedTools = new Map<string, StorageCachedTool>();
  readonly workflowDefinitions = new Map<string, StorageWorkflowDefinitionType>();
  readonly workflowDefinitionVersions = new Map<string, WorkflowDefinitionVersion>();
  readonly storedScorers = new Map<string, StoredScorerType>();
  readonly scorerVersions = new Map<string, StoredScorerVersionType>();

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
    this.integrations.clear();
    this.cachedTools.clear();
    this.workflowDefinitions.clear();
    this.workflowDefinitionVersions.clear();
    this.storedScorers.clear();
    this.scorerVersions.clear();
  }
}
