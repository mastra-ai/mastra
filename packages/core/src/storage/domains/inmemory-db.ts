import type { ScoreRowData } from '../../evals/types';
import type { StorageThreadType } from '../../memory/types';
import type {
  StorageAgentType,
  StorageMessageType,
  StoragePromptBlockType,
  StorageResourceType,
  StorageWorkflowRun,
  ObservationalMemoryRecord,
  DatasetRecord,
  DatasetItem,
  DatasetItemVersion,
  DatasetVersion,
  Experiment,
  ExperimentResult,
} from '../types';
import type { AgentVersion } from './agents';
import type { TraceEntry } from './observability';
import type { PromptBlockVersion } from './prompt-blocks';

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
  /** Observational memory records, keyed by resourceId, each holding array of records (generations) */
  readonly observationalMemory = new Map<string, ObservationalMemoryRecord[]>();

  // Dataset domain maps
  readonly datasets = new Map<string, DatasetRecord>();
  readonly datasetItems = new Map<string, DatasetItem>();
  readonly itemVersions = new Map<string, DatasetItemVersion>();
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
    this.observationalMemory.clear();
    this.datasets.clear();
    this.datasetItems.clear();
    this.itemVersions.clear();
    this.datasetVersions.clear();
    this.experiments.clear();
    this.experimentResults.clear();
  }
}
