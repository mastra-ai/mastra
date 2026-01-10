import type {
  StorageScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  StorageAgentScorerAssignment,
  StorageCreateAgentScorerAssignmentInput,
  StorageUpdateAgentScorerAssignmentInput,
  StorageListAgentScorerAssignmentsInput,
  StorageListAgentScorerAssignmentsOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

/**
 * Abstract base class for stored scorer storage operations.
 *
 * This domain handles:
 * 1. CRUD operations for stored scorer definitions
 * 2. Agent-scorer assignment management for dynamic scorer binding
 *
 * Note: This is different from the `scores` domain which stores score execution results.
 * This domain stores scorer *definitions* that can be instantiated at runtime.
 */
export abstract class StoredScorersStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'STORED_SCORERS',
    });
  }

  // ============================================================================
  // Scorer Definition CRUD
  // ============================================================================

  /**
   * Retrieves a stored scorer by its unique identifier.
   * @param id - The unique identifier of the scorer
   * @returns The scorer if found, null otherwise
   */
  abstract getScorerById({ id }: { id: string }): Promise<StorageScorerType | null>;

  /**
   * Creates a new stored scorer definition.
   * @param scorer - The scorer configuration to create
   * @returns The created scorer with timestamps
   */
  abstract createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StorageScorerType>;

  /**
   * Updates an existing stored scorer definition.
   * @param id - The unique identifier of the scorer to update
   * @param updates - The fields to update
   * @returns The updated scorer
   */
  abstract updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StorageScorerType>;

  /**
   * Deletes a stored scorer definition.
   * This will also delete any agent-scorer assignments referencing this scorer.
   * @param id - The unique identifier of the scorer to delete
   */
  abstract deleteScorer({ id }: { id: string }): Promise<void>;

  /**
   * Lists all stored scorers with optional pagination.
   * @param args - Pagination and ordering options
   * @returns Paginated list of scorers
   */
  abstract listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput>;

  // ============================================================================
  // Agent-Scorer Assignments
  // ============================================================================

  /**
   * Assigns a stored scorer to an agent.
   * This creates a dynamic binding that allows the scorer to run on the agent
   * without modifying the agent's code-defined scorers.
   * @param input - Assignment configuration
   * @returns The created assignment
   */
  abstract assignScorerToAgent(input: StorageCreateAgentScorerAssignmentInput): Promise<StorageAgentScorerAssignment>;

  /**
   * Removes a scorer assignment from an agent.
   * @param params - Agent and scorer IDs
   */
  abstract unassignScorerFromAgent(params: { agentId: string; scorerId: string }): Promise<void>;

  /**
   * Lists all scorer assignments for an agent.
   * @param input - Query parameters including agent ID and filters
   * @returns Paginated list of assignments
   */
  abstract listAgentScorerAssignments(
    input: StorageListAgentScorerAssignmentsInput,
  ): Promise<StorageListAgentScorerAssignmentsOutput>;

  /**
   * Updates an existing agent-scorer assignment.
   * @param params - Assignment ID and fields to update
   * @returns The updated assignment
   */
  abstract updateAgentScorerAssignment(
    params: StorageUpdateAgentScorerAssignmentInput,
  ): Promise<StorageAgentScorerAssignment>;

  /**
   * Gets a specific assignment by ID.
   * @param id - The assignment ID
   * @returns The assignment if found, null otherwise
   */
  abstract getAssignmentById({ id }: { id: string }): Promise<StorageAgentScorerAssignment | null>;

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Parses orderBy input for consistent sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in SCORER_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in SCORER_SORT_DIRECTION_SET ? orderBy.direction : defaultDirection,
    };
  }
}

const SCORER_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const SCORER_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};
