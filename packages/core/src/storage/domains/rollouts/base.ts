import type {
  RolloutRecord,
  RolloutStatus,
  CreateRolloutInput,
  UpdateRolloutInput,
  ListRolloutsInput,
  ListRolloutsOutput,
} from '../../types';
import { StorageDomain } from '../base';

/**
 * Abstract base class for rollouts storage domain.
 * Provides the contract for agent version rollout lifecycle management.
 */
export abstract class RolloutsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'ROLLOUTS',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  /** Get the active rollout for an agent (at most one). */
  abstract getActiveRollout(agentId: string): Promise<RolloutRecord | null>;

  /** Get a rollout by ID. */
  abstract getRollout(id: string): Promise<RolloutRecord | null>;

  /** Create a new rollout. */
  abstract createRollout(input: CreateRolloutInput): Promise<RolloutRecord>;

  /** Update an active rollout (e.g. change weights or rules). */
  abstract updateRollout(input: UpdateRolloutInput): Promise<RolloutRecord>;

  /** Mark a rollout as completed with a terminal status. */
  abstract completeRollout(id: string, status: RolloutStatus, completedAt?: Date): Promise<RolloutRecord>;

  /** List rollouts for an agent (history). */
  abstract listRollouts(input: ListRolloutsInput): Promise<ListRolloutsOutput>;
}
