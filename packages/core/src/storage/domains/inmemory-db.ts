import type { ScoreRowData } from '../../evals/types';
import type { StorageThreadType } from '../../memory/types';
import type { StorageAgentType, StorageMessageType, StorageResourceType, StorageWorkflowRun } from '../types';
import type { AgentVersion } from './agent-versions/base';
import type { TraceEntry } from './observability';

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
  }
}
