/**
 * In-memory intake settings storage for unit tests.
 *
 * Reads re-validate through {@link parseIntakeConfig} so test fixtures that
 * seed prerelease/old-key JSON match the Postgres boundary.
 */

import { DEFAULT_INTAKE_CONFIG, IntakeStorage, parseIntakeConfig } from './base';
import type { IntakeConfig } from './base';

export class IntakeStorageInMemory extends IntakeStorage {
  #configs = new Map<string, unknown>();

  async init(): Promise<void> {
    // Nothing to set up.
  }

  #key(orgId: string, userId: string): string {
    return `${orgId}\u0000${userId}`;
  }

  async getConfig(orgId: string, userId: string): Promise<IntakeConfig> {
    const raw = this.#configs.get(this.#key(orgId, userId));
    if (raw === undefined) return structuredClone(DEFAULT_INTAKE_CONFIG);
    const parsed = parseIntakeConfig(raw);
    return structuredClone(parsed ?? DEFAULT_INTAKE_CONFIG);
  }

  async saveConfig(orgId: string, userId: string, config: IntakeConfig): Promise<void> {
    this.#configs.set(this.#key(orgId, userId), structuredClone(config));
  }

  /**
   * Test-only: seed arbitrary JSON (including prerelease shapes) without
   * going through the typed save path.
   */
  seedRawConfig(orgId: string, userId: string, raw: unknown): void {
    this.#configs.set(this.#key(orgId, userId), structuredClone(raw));
  }
}
