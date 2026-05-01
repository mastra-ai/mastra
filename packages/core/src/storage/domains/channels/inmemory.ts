import type { ChannelInstallation, ChannelConfig } from './base';
import { ChannelsStorage } from './base';

/**
 * In-memory implementation of ChannelsStorage.
 * Useful for development and testing.
 */
export class InMemoryChannelsStorage extends ChannelsStorage {
  #installations = new Map<string, ChannelInstallation>();
  #configs = new Map<string, ChannelConfig>();

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

  async dangerouslyClearAll(): Promise<void> {
    this.#installations.clear();
    this.#configs.clear();
  }
}
