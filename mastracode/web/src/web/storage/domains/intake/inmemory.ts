/**
 * In-memory intake settings storage for unit tests.
 */

import { DEFAULT_INTAKE_CONFIG, IntakeStorage } from './base';
import type { IntakeConfig } from './base';

export class IntakeStorageInMemory extends IntakeStorage {
  #configs = new Map<string, IntakeConfig>();

  async init(): Promise<void> {
    // Nothing to set up.
  }

  #key(orgId: string, userId: string): string {
    return `${orgId}\u0000${userId}`;
  }

  async getConfig(orgId: string, userId: string): Promise<IntakeConfig> {
    const config = this.#configs.get(this.#key(orgId, userId));
    return config ? structuredClone(config) : DEFAULT_INTAKE_CONFIG;
  }

  async saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
    this.#configs.set(this.#key(orgId, userId), structuredClone(config));
  }
}
