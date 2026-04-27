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
    return this.#installations.get(id) ?? null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    for (const installation of this.#installations.values()) {
      if (installation.platform === platform && installation.agentId === agentId) {
        return installation;
      }
    }
    return null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    for (const installation of this.#installations.values()) {
      if (installation.webhookId === webhookId) {
        return installation;
      }
    }
    return null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const results: ChannelInstallation[] = [];
    for (const installation of this.#installations.values()) {
      if (installation.platform === platform) {
        results.push(installation);
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
    return this.#configs.get(platform) ?? null;
  }

  async deleteConfig(platform: string): Promise<void> {
    this.#configs.delete(platform);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#installations.clear();
    this.#configs.clear();
  }
}
