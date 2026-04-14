import { calculatePagination, normalizePerPage } from '../../base';
import type {
  RolloutRecord,
  RolloutStatus,
  CreateRolloutInput,
  UpdateRolloutInput,
  ListRolloutsInput,
  ListRolloutsOutput,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { RolloutsStorage } from './base';

function cloneRollout(r: RolloutRecord): RolloutRecord {
  return {
    ...r,
    allocations: r.allocations.map(a => ({ ...a })),
    rules: r.rules?.map(rule => ({ ...rule })),
  };
}

export class RolloutsInMemory extends RolloutsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.rollouts.clear();
  }

  async getActiveRollout(agentId: string): Promise<RolloutRecord | null> {
    for (const rollout of this.db.rollouts.values()) {
      if (rollout.agentId === agentId && rollout.status === 'active') {
        return cloneRollout(rollout);
      }
    }
    return null;
  }

  async getRollout(id: string): Promise<RolloutRecord | null> {
    const rollout = this.db.rollouts.get(id);
    return rollout ? cloneRollout(rollout) : null;
  }

  async createRollout(input: CreateRolloutInput): Promise<RolloutRecord> {
    const id = input.id ?? `rol_${crypto.randomUUID()}`;
    if (this.db.rollouts.has(id)) {
      throw new Error(`Rollout already exists: ${id}`);
    }
    for (const rollout of this.db.rollouts.values()) {
      if (rollout.agentId === input.agentId && rollout.status === 'active') {
        throw new Error(`Active rollout already exists for agent: ${input.agentId}`);
      }
    }

    const now = new Date();
    const rollout: RolloutRecord = {
      id,
      agentId: input.agentId,
      type: input.type,
      status: 'active',
      stableVersionId: input.stableVersionId,
      allocations: input.allocations.map(a => ({ ...a })),
      routingKey: input.routingKey,
      rules: input.rules?.map(r => ({ ...r })),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.db.rollouts.set(rollout.id, rollout);
    return cloneRollout(rollout);
  }

  async updateRollout(input: UpdateRolloutInput): Promise<RolloutRecord> {
    const existing = this.db.rollouts.get(input.id);
    if (!existing) {
      throw new Error(`Rollout not found: ${input.id}`);
    }
    if (existing.status !== 'active') {
      throw new Error(`Cannot update rollout with status: ${existing.status}`);
    }
    const updated: RolloutRecord = {
      ...existing,
      allocations: input.allocations ?? existing.allocations,
      rules: input.rules ?? existing.rules,
      updatedAt: new Date(),
    };
    this.db.rollouts.set(input.id, updated);
    return cloneRollout(updated);
  }

  async completeRollout(id: string, status: RolloutStatus, completedAt?: Date): Promise<RolloutRecord> {
    const existing = this.db.rollouts.get(id);
    if (!existing) {
      throw new Error(`Rollout not found: ${id}`);
    }
    if (existing.status !== 'active') {
      throw new Error(`Cannot complete rollout with status: ${existing.status}`);
    }
    const now = completedAt ?? new Date();
    const updated: RolloutRecord = {
      ...existing,
      status,
      updatedAt: now,
      completedAt: now,
    };
    this.db.rollouts.set(id, updated);
    return cloneRollout(updated);
  }

  async listRollouts(input: ListRolloutsInput): Promise<ListRolloutsOutput> {
    let rollouts = Array.from(this.db.rollouts.values()).filter(r => r.agentId === input.agentId);

    // Sort by createdAt descending (newest first)
    rollouts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const { page, perPage: perPageInput } = input.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? rollouts.length : start + perPage;

    return {
      rollouts: rollouts.slice(start, end).map(cloneRollout),
      pagination: {
        total: rollouts.length,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : rollouts.length > end,
      },
    };
  }
}
