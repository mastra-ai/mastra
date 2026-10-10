import type {
  ChannelInstallation,
  ChannelConfig,
  ChannelThreadKey,
  ChannelThreadMapping,
  ChannelThreadMappingInput,
} from './base';
import { ChannelsStorage } from './base';

function mappingKey({ platform, ownerId, externalThreadId }: ChannelThreadKey): string {
  return `${platform}\u0000${ownerId}\u0000${externalThreadId}`;
}

/**
 * In-memory implementation of ChannelsStorage.
 * Useful for development and testing.
 */
export class InMemoryChannelsStorage extends ChannelsStorage {
  #installations = new Map<string, ChannelInstallation>();
  #configs = new Map<string, ChannelConfig>();
  #threadMappings = new Map<string, ChannelThreadMapping>();

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

  async getThreadMapping(key: ChannelThreadKey): Promise<ChannelThreadMapping | null> {
    const mapping = this.#threadMappings.get(mappingKey(key));
    return mapping ? { ...mapping } : null;
  }

  async getThreadMappingByThreadId(threadId: string): Promise<ChannelThreadMapping | null> {
    for (const mapping of this.#threadMappings.values()) {
      if (mapping.threadId === threadId) {
        return { ...mapping };
      }
    }
    return null;
  }

  async upsertThreadMapping(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping> {
    const key = mappingKey(mapping);
    const now = new Date();
    const existing = this.#threadMappings.get(key);
    const stored: ChannelThreadMapping = existing
      ? {
          ...existing,
          externalChannelId: mapping.externalChannelId,
          subscribed: mapping.subscribed ?? existing.subscribed,
          updatedAt: now,
        }
      : {
          platform: mapping.platform,
          ownerId: mapping.ownerId,
          externalThreadId: mapping.externalThreadId,
          externalChannelId: mapping.externalChannelId,
          threadId: mapping.threadId,
          subscribed: mapping.subscribed ?? false,
          createdAt: now,
          updatedAt: now,
        };
    this.#threadMappings.set(key, stored);
    return { ...stored };
  }

  async setThreadSubscribed(key: ChannelThreadKey, subscribed: boolean): Promise<void> {
    const existing = this.#threadMappings.get(mappingKey(key));
    if (!existing) return;
    this.#threadMappings.set(mappingKey(key), { ...existing, subscribed, updatedAt: new Date() });
  }

  async deleteThreadMapping(key: ChannelThreadKey): Promise<void> {
    this.#threadMappings.delete(mappingKey(key));
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#installations.clear();
    this.#configs.clear();
    this.#threadMappings.clear();
  }
}
