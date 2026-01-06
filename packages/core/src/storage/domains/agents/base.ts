import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

export abstract class AgentsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'AGENTS',
    });
  }

  /**
   * Retrieves an agent by its unique identifier.
   * @param id - The unique identifier of the agent
   * @returns The agent if found, null otherwise
   */
  abstract getAgentById({ id }: { id: string }): Promise<StorageAgentType | null>;

  /**
   * Creates a new agent in storage.
   * @param agent - The agent data to create
   * @returns The created agent with timestamps
   */
  abstract createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType>;

  /**
   * Updates an existing agent in storage.
   * @param id - The unique identifier of the agent to update
   * @param updates - The fields to update
   * @returns The updated agent
   */
  abstract updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType>;

  /**
   * Deletes an agent from storage.
   * @param id - The unique identifier of the agent to delete
   */
  abstract deleteAgent({ id }: { id: string }): Promise<void>;

  /**
   * Lists all agents with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of agents
   */
  abstract listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput>;

  /**
   * Parses orderBy input for consistent sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in AGENT_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in AGENT_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }
}

const AGENT_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const AGENT_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};
