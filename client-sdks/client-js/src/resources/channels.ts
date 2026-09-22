import type { Body, PathParams, RouteResponse } from '../route-types.generated.js';
import type { ClientOptions } from '../types';

import { BaseResource } from './base';

export type ChannelPlatformInfo = RouteResponse<'GET /channels/platforms'>[number];

export type ChannelInstallationInfo = RouteResponse<'GET /channels/:platform/installations'>[number];

export type ChannelConnectResult = RouteResponse<'POST /channels/:platform/connect'>;
export type ChannelConnectOAuth = Extract<ChannelConnectResult, { type: 'oauth' }>;
export type ChannelConnectDeepLink = Extract<ChannelConnectResult, { type: 'deep_link' }>;
export type ChannelConnectImmediate = Extract<ChannelConnectResult, { type: 'immediate' }>;

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
  async listInstallations(
    platform: PathParams<'GET /channels/:platform/installations'>['platform'],
    agentId?: string,
  ): Promise<ChannelInstallationInfo[]> {
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
  connect(
    platform: PathParams<'POST /channels/:platform/connect'>['platform'],
    agentId: Body<'POST /channels/:platform/connect'>['agentId'],
    options?: Body<'POST /channels/:platform/connect'>['options'],
  ): Promise<ChannelConnectResult> {
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
  disconnect(
    platform: PathParams<'POST /channels/:platform/:agentId/disconnect'>['platform'],
    agentId: PathParams<'POST /channels/:platform/:agentId/disconnect'>['agentId'],
  ): Promise<RouteResponse<'POST /channels/:platform/:agentId/disconnect'>> {
    return this.request(`/channels/${platform}/${agentId}/disconnect`, {
      method: 'POST',
    });
  }
}
