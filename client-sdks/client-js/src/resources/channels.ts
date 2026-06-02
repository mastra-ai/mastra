import type { ClientOptions } from '../types';

import { BaseResource } from './base';

export interface ChannelPlatformInfo {
  id: string;
  name: string;
  isConfigured: boolean;
  connectOptionsSchema?: Record<string, unknown>;
}

export interface ChannelInstallationInfo {
  id: string;
  platform: string;
  agentId: string;
  status: 'active' | 'pending';
  displayName?: string;
  installedAt?: string;
}

export interface ChannelConnectOAuth {
  type: 'oauth';
  authorizationUrl: string;
  installationId: string;
}

export interface ChannelConnectDeepLink {
  type: 'deep_link';
  url: string;
  installationId: string;
}

export interface ChannelConnectImmediate {
  type: 'immediate';
  installationId: string;
}

export type ChannelConnectResult = ChannelConnectOAuth | ChannelConnectDeepLink | ChannelConnectImmediate;

export class Channels extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Lists all registered channel platforms and their configuration status.
   * @returns Array of available platforms
   */
  listPlatforms(): Promise<ChannelPlatformInfo[]> {
    return this.request('/channels/platforms');
  }

  /**
   * Lists installations for a given platform, optionally filtered by agent.
   * @param platform - Platform identifier (e.g., "slack")
   * @param agentId - Optional agent ID to filter by (client-side)
   * @returns Array of installations
   */
  async listInstallations(platform: string, agentId?: string): Promise<ChannelInstallationInfo[]> {
    const all = await this.request<ChannelInstallationInfo[]>(`/channels/${platform}/installations`);
    if (agentId) {
      return all.filter(i => i.agentId === agentId);
    }
    return all;
  }

  /**
   * Connects an agent to a channel platform.
   * @param platform - Platform identifier (e.g., "slack")
   * @param agentId - Agent to connect
   * @param options - Platform-specific connection options
   * @returns Discriminated connect result — check `type` for the authorization flow
   */
  connect(platform: string, agentId: string, options?: Record<string, unknown>): Promise<ChannelConnectResult> {
    return this.request(`/channels/${platform}/connect`, {
      method: 'POST',
      body: { agentId, options },
    });
  }

  /**
   * Disconnects an agent from a channel platform.
   * @param platform - Platform identifier (e.g., "slack")
   * @param agentId - Agent to disconnect
   */
  disconnect(platform: string, agentId: string): Promise<{ success: boolean }> {
    return this.request(`/channels/${platform}/${agentId}/disconnect`, {
      method: 'POST',
    });
  }
}
