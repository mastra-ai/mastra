import type { SlackStorage, SlackInstallation, PendingInstallation, StoredConfigTokens } from './types';

/**
 * In-memory storage for development/testing.
 * Use a database-backed implementation for production.
 */
export class InMemorySlackStorage implements SlackStorage {
  #configTokens: StoredConfigTokens | null = null;
  #pendingInstallations = new Map<string, PendingInstallation>();
  #pendingByAgentId = new Map<string, string>(); // agentId -> pendingId
  #installations = new Map<string, SlackInstallation>();
  #webhookIndex = new Map<string, string>(); // webhookId -> installationId
  #agentIndex = new Map<string, string>(); // agentId -> installationId

  async saveConfigTokens(tokens: StoredConfigTokens): Promise<void> {
    this.#configTokens = tokens;
  }

  async getConfigTokens(): Promise<StoredConfigTokens | null> {
    return this.#configTokens;
  }

  async savePendingInstallation(pending: PendingInstallation): Promise<void> {
    this.#pendingInstallations.set(pending.id, pending);
    this.#pendingByAgentId.set(pending.agentId, pending.id);
  }

  async getPendingInstallation(id: string): Promise<PendingInstallation | null> {
    return this.#pendingInstallations.get(id) ?? null;
  }

  async getPendingInstallationByAgentId(agentId: string): Promise<PendingInstallation | null> {
    const id = this.#pendingByAgentId.get(agentId);
    if (!id) return null;
    return this.#pendingInstallations.get(id) ?? null;
  }

  async listPendingInstallations(): Promise<PendingInstallation[]> {
    return Array.from(this.#pendingInstallations.values());
  }

  async deletePendingInstallation(id: string): Promise<void> {
    const pending = this.#pendingInstallations.get(id);
    if (pending) {
      this.#pendingByAgentId.delete(pending.agentId);
      this.#pendingInstallations.delete(id);
    }
  }

  async saveInstallation(installation: SlackInstallation): Promise<void> {
    this.#installations.set(installation.id, installation);
    this.#webhookIndex.set(installation.webhookId, installation.id);
    this.#agentIndex.set(installation.agentId, installation.id);
  }

  async getInstallation(agentId: string): Promise<SlackInstallation | null> {
    const installationId = this.#agentIndex.get(agentId);
    if (!installationId) return null;
    return this.#installations.get(installationId) ?? null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<SlackInstallation | null> {
    const installationId = this.#webhookIndex.get(webhookId);
    if (!installationId) return null;
    return this.#installations.get(installationId) ?? null;
  }

  async deleteInstallation(id: string): Promise<void> {
    const installation = this.#installations.get(id);
    if (installation) {
      this.#webhookIndex.delete(installation.webhookId);
      this.#agentIndex.delete(installation.agentId);
      this.#installations.delete(id);
    }
  }

  async listInstallations(): Promise<SlackInstallation[]> {
    return Array.from(this.#installations.values());
  }
}
