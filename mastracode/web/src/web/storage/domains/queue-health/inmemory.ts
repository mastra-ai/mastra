/**
 * In-memory queue-health settings storage for unit tests.
 */

import { assertValidThresholds, DEFAULT_QUEUE_HEALTH_CONFIG, QueueHealthStorage } from './base';
import type { QueueHealthConfig } from './base';

export class QueueHealthStorageInMemory extends QueueHealthStorage {
  #configs = new Map<string, QueueHealthConfig>();

  async init(): Promise<void> {
    // Nothing to set up.
  }

  #key(orgId: string, githubProjectId: string): string {
    return `${orgId}\u0000${githubProjectId}`;
  }

  async getConfig(orgId: string, githubProjectId: string): Promise<QueueHealthConfig> {
    const config = this.#configs.get(this.#key(orgId, githubProjectId));
    return structuredClone(config ?? DEFAULT_QUEUE_HEALTH_CONFIG);
  }

  async saveConfig(orgId: string, githubProjectId: string, config: QueueHealthConfig): Promise<void> {
    assertValidThresholds(config);
    this.#configs.set(this.#key(orgId, githubProjectId), structuredClone(config));
  }
}
