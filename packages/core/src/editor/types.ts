import type { Agent } from '../agent';
import type { IMastraLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { StorageResolvedAgentType } from '../storage/types';

export interface MastraEditorConfig {
  logger?: IMastraLogger;
}

/**
 * Interface for the Mastra Editor, which handles agent instantiation
 * and configuration from stored data.
 */
export interface IMastraEditor {
  /**
   * Register this editor with a Mastra instance.
   * This gives the editor access to Mastra's storage, tools, workflows, etc.
   */
  registerWithMastra(mastra: Mastra): void;

  /**
   * Get a stored agent by its ID.
   * Returns null when agent is not found. Returns an Agent instance by default,
   * or raw StorageResolvedAgentType when returnRaw option is true.
   */
  getStoredAgentById(
    id: string,
    options?: {
      returnRaw?: false;
      versionId?: string;
      versionNumber?: number;
    },
  ): Promise<Agent | null>;

  getStoredAgentById(
    id: string,
    options: {
      returnRaw: true;
      versionId?: string;
      versionNumber?: number;
    },
  ): Promise<StorageResolvedAgentType | null>;

  /**
   * List all stored agents with pagination.
   * Returns Agent instances by default, or raw StorageResolvedAgentType when returnRaw is true.
   */
  listStoredAgents(options?: { returnRaw?: false; page?: number; pageSize?: number }): Promise<{
    agents: Agent[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;

  listStoredAgents(options: { returnRaw: true; page?: number; pageSize?: number }): Promise<{
    agents: StorageResolvedAgentType[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }>;

  /**
   * Clear the stored agent cache for a specific agent ID, or all cached agents.
   */
  clearStoredAgentCache(agentId?: string): void;
}
