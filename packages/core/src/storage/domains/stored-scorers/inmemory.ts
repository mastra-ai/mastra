import { randomUUID } from 'crypto';

import { normalizePerPage, calculatePagination } from '../../base';
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
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { StoredScorersStorage } from './base';

/**
 * In-memory implementation of StoredScorersStorage.
 * Useful for development, testing, and scenarios where persistence isn't required.
 */
export class InMemoryStoredScorersStorage extends StoredScorersStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
    // The InMemoryDB already initializes the maps in its class definition
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.storedScorers.clear();
    this.db.agentScorerAssignments.clear();
  }

  // ============================================================================
  // Scorer Definition CRUD
  // ============================================================================

  async getScorerById({ id }: { id: string }): Promise<StorageScorerType | null> {
    this.logger.debug(`InMemoryStoredScorersStorage: getScorerById called for ${id}`);
    const scorer = this.db.storedScorers.get(id);
    return scorer ? this.cloneScorer(scorer) : null;
  }

  async createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StorageScorerType> {
    this.logger.debug(`InMemoryStoredScorersStorage: createScorer called for ${scorer.id}`);

    if (this.db.storedScorers.has(scorer.id)) {
      throw new Error(`Scorer with id ${scorer.id} already exists`);
    }

    const now = new Date();
    const newScorer: StorageScorerType = {
      ...scorer,
      createdAt: now,
      updatedAt: now,
    };

    this.db.storedScorers.set(scorer.id, newScorer);
    return this.cloneScorer(newScorer);
  }

  async updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StorageScorerType> {
    this.logger.debug(`InMemoryStoredScorersStorage: updateScorer called for ${id}`);

    const existingScorer = this.db.storedScorers.get(id);
    if (!existingScorer) {
      throw new Error(`Scorer with id ${id} not found`);
    }

    const updatedScorer: StorageScorerType = {
      ...existingScorer,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.judge !== undefined && { judge: updates.judge }),
      ...(updates.steps !== undefined && { steps: updates.steps }),
      ...(updates.sampling !== undefined && { sampling: updates.sampling }),
      ...(updates.metadata !== undefined && {
        metadata: { ...existingScorer.metadata, ...updates.metadata },
      }),
      updatedAt: new Date(),
    };

    this.db.storedScorers.set(id, updatedScorer);
    return this.cloneScorer(updatedScorer);
  }

  async deleteScorer({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryStoredScorersStorage: deleteScorer called for ${id}`);

    // Delete the scorer
    this.db.storedScorers.delete(id);

    // Also delete any assignments referencing this scorer
    for (const [assignmentId, assignment] of this.db.agentScorerAssignments.entries()) {
      if (assignment.scorerId === id) {
        this.db.agentScorerAssignments.delete(assignmentId);
      }
    }
  }

  async listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryStoredScorersStorage: listScorers called`);

    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    const scorers = Array.from(this.db.storedScorers.values());
    const sortedScorers = this.sortScorers(scorers, field, direction);
    const clonedScorers = sortedScorers.map(s => this.cloneScorer(s));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      scorers: clonedScorers.slice(offset, offset + perPage),
      total: clonedScorers.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedScorers.length,
    };
  }

  // ============================================================================
  // Agent-Scorer Assignments
  // ============================================================================

  async assignScorerToAgent(input: StorageCreateAgentScorerAssignmentInput): Promise<StorageAgentScorerAssignment> {
    this.logger.debug(
      `InMemoryStoredScorersStorage: assignScorerToAgent called for agent ${input.agentId}, scorer ${input.scorerId}`,
    );

    // Check if scorer exists
    if (!this.db.storedScorers.has(input.scorerId)) {
      throw new Error(`Scorer with id ${input.scorerId} not found`);
    }

    // Check for existing assignment
    for (const assignment of this.db.agentScorerAssignments.values()) {
      if (assignment.agentId === input.agentId && assignment.scorerId === input.scorerId) {
        throw new Error(`Assignment already exists for agent ${input.agentId} and scorer ${input.scorerId}`);
      }
    }

    const now = new Date();
    const assignment: StorageAgentScorerAssignment = {
      id: randomUUID(),
      agentId: input.agentId,
      scorerId: input.scorerId,
      sampling: input.sampling,
      enabled: input.enabled,
      priority: input.priority,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.agentScorerAssignments.set(assignment.id, assignment);
    return this.cloneAssignment(assignment);
  }

  async unassignScorerFromAgent(params: { agentId: string; scorerId: string }): Promise<void> {
    this.logger.debug(
      `InMemoryStoredScorersStorage: unassignScorerFromAgent called for agent ${params.agentId}, scorer ${params.scorerId}`,
    );

    for (const [id, assignment] of this.db.agentScorerAssignments.entries()) {
      if (assignment.agentId === params.agentId && assignment.scorerId === params.scorerId) {
        this.db.agentScorerAssignments.delete(id);
        return;
      }
    }
  }

  async listAgentScorerAssignments(
    input: StorageListAgentScorerAssignmentsInput,
  ): Promise<StorageListAgentScorerAssignmentsOutput> {
    const { agentId, enabledOnly, page = 0, perPage: perPageInput } = input;

    this.logger.debug(`InMemoryStoredScorersStorage: listAgentScorerAssignments called for agent ${agentId}`);

    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    let assignments = Array.from(this.db.agentScorerAssignments.values()).filter(a => a.agentId === agentId);

    if (enabledOnly) {
      assignments = assignments.filter(a => a.enabled);
    }

    // Sort by priority (lower = higher priority), then by createdAt
    assignments.sort((a, b) => {
      const priorityA = a.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const clonedAssignments = assignments.map(a => this.cloneAssignment(a));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      assignments: clonedAssignments.slice(offset, offset + perPage),
      total: clonedAssignments.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedAssignments.length,
    };
  }

  async updateAgentScorerAssignment(
    params: StorageUpdateAgentScorerAssignmentInput,
  ): Promise<StorageAgentScorerAssignment> {
    this.logger.debug(`InMemoryStoredScorersStorage: updateAgentScorerAssignment called for ${params.id}`);

    const existingAssignment = this.db.agentScorerAssignments.get(params.id);
    if (!existingAssignment) {
      throw new Error(`Assignment with id ${params.id} not found`);
    }

    const updatedAssignment: StorageAgentScorerAssignment = {
      ...existingAssignment,
      ...(params.enabled !== undefined && { enabled: params.enabled }),
      ...(params.sampling !== undefined && { sampling: params.sampling }),
      ...(params.priority !== undefined && { priority: params.priority }),
      ...(params.metadata !== undefined && {
        metadata: { ...existingAssignment.metadata, ...params.metadata },
      }),
      updatedAt: new Date(),
    };

    this.db.agentScorerAssignments.set(params.id, updatedAssignment);
    return this.cloneAssignment(updatedAssignment);
  }

  async getAssignmentById({ id }: { id: string }): Promise<StorageAgentScorerAssignment | null> {
    this.logger.debug(`InMemoryStoredScorersStorage: getAssignmentById called for ${id}`);
    const assignment = this.db.agentScorerAssignments.get(id);
    return assignment ? this.cloneAssignment(assignment) : null;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private sortScorers(
    scorers: StorageScorerType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageScorerType[] {
    return scorers.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();
      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private cloneScorer(scorer: StorageScorerType): StorageScorerType {
    return {
      ...scorer,
      type: scorer.type ? (typeof scorer.type === 'string' ? scorer.type : { ...scorer.type }) : scorer.type,
      judge: scorer.judge ? { ...scorer.judge } : scorer.judge,
      steps: scorer.steps.map(s => ({ ...s, judge: s.judge ? { ...s.judge } : s.judge })),
      sampling: scorer.sampling ? { ...scorer.sampling } : scorer.sampling,
      metadata: scorer.metadata ? { ...scorer.metadata } : scorer.metadata,
    };
  }

  private cloneAssignment(assignment: StorageAgentScorerAssignment): StorageAgentScorerAssignment {
    return {
      ...assignment,
      sampling: assignment.sampling ? { ...assignment.sampling } : assignment.sampling,
      metadata: assignment.metadata ? { ...assignment.metadata } : assignment.metadata,
    };
  }
}
