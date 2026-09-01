import type { ChannelInstallation, ChannelConfig, ChannelStateEntry } from './base';
import { ChannelsStorage } from './base';

interface StoredState {
  /** JSON text, matching what the SQL stores round-trip, so both behave identically. */
  json: string;
  expiresAt: number | null;
}

/**
 * In-memory implementation of ChannelsStorage.
 * Useful for development and testing.
 */
export class InMemoryChannelsStorage extends ChannelsStorage {
  override readonly supportsChannelState = true;

  #installations = new Map<string, ChannelInstallation>();
  #configs = new Map<string, ChannelConfig>();
  #state = new Map<string, StoredState>();

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    this.#installations.set(installation.id, { ...installation });
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const inst = this.#installations.get(id);
    return inst ? { ...inst } : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const statusPriority = { active: 0, pending: 1, error: 2 } as const;
    let best: ChannelInstallation | null = null;
    for (const installation of this.#installations.values()) {
      if (installation.platform === platform && installation.agentId === agentId) {
        if (!best || (statusPriority[installation.status] ?? 3) < (statusPriority[best.status] ?? 3)) {
          best = installation;
        }
      }
    }
    return best ? { ...best } : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    for (const installation of this.#installations.values()) {
      if (installation.webhookId === webhookId) {
        return { ...installation };
      }
    }
    return null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const results: ChannelInstallation[] = [];
    for (const installation of this.#installations.values()) {
      if (installation.platform === platform) {
        results.push({ ...installation });
      }
    }
    return results;
  }

  async deleteInstallation(id: string): Promise<void> {
    this.#installations.delete(id);
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    this.#configs.set(config.platform, { ...config });
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const config = this.#configs.get(platform);
    return config ? { ...config } : null;
  }

  async deleteConfig(platform: string): Promise<void> {
    this.#configs.delete(platform);
  }

  #stateKey(ownerId: string, key: string): string {
    return `${ownerId}\u0000${key}`;
  }

  async getState(ownerId: string, key: string): Promise<ChannelStateEntry | null> {
    const mapKey = this.#stateKey(ownerId, key);
    const entry = this.#state.get(mapKey);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.#state.delete(mapKey);
      return null;
    }
    return { value: JSON.parse(entry.json) };
  }

  async setState(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<void> {
    this.#state.set(this.#stateKey(ownerId, key), { json: JSON.stringify(value ?? null), expiresAt });
  }

  async setStateIfNotExists(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<boolean> {
    const mapKey = this.#stateKey(ownerId, key);
    const existing = this.#state.get(mapKey);
    const isLive = existing && (existing.expiresAt === null || existing.expiresAt > Date.now());
    if (isLive) return false;
    this.#state.set(mapKey, { json: JSON.stringify(value ?? null), expiresAt });
    return true;
  }

  async deleteState(ownerId: string, key: string): Promise<void> {
    this.#state.delete(this.#stateKey(ownerId, key));
  }

  async deleteExpiredState(now: number): Promise<void> {
    for (const [mapKey, entry] of this.#state) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        this.#state.delete(mapKey);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#installations.clear();
    this.#configs.clear();
    this.#state.clear();
  }
}
