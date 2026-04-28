import type {
  IEditorChannelNamespace,
  ChannelPlatformInfo,
  ChannelInstallationInfo,
  ChannelConnectResult,
} from '@mastra/core/editor';
import type { MastraChannel } from '@mastra/core/channels';

import { EditorNamespace } from './base';

/**
 * Editor namespace for managing platform channel connections.
 *
 * Proxies discovery and management calls through to the MastraChannel
 * implementations registered on the Mastra instance (e.g., SlackChannel).
 */
export class EditorChannelNamespace extends EditorNamespace implements IEditorChannelNamespace {
  listPlatforms(): ChannelPlatformInfo[] {
    const channels = this.#getChannels();
    return Object.entries(channels).map(([, channel]) => {
      if (channel.getInfo) {
        return channel.getInfo();
      }
      // Fallback for channels that don't implement getInfo
      return {
        id: channel.id,
        name: channel.id.charAt(0).toUpperCase() + channel.id.slice(1),
        isConfigured: true,
      };
    });
  }

  async listInstallations(agentId: string): Promise<ChannelInstallationInfo[]> {
    const channels = this.#getChannels();
    const results: ChannelInstallationInfo[] = [];

    for (const channel of Object.values(channels)) {
      if (!channel.listInstallations) continue;
      const installations = await channel.listInstallations();
      results.push(...installations.filter((i) => i.agentId === agentId));
    }

    return results;
  }

  async listAllInstallations(): Promise<ChannelInstallationInfo[]> {
    const channels = this.#getChannels();
    const results: ChannelInstallationInfo[] = [];

    for (const channel of Object.values(channels)) {
      if (!channel.listInstallations) continue;
      const installations = await channel.listInstallations();
      results.push(...installations);
    }

    return results;
  }

  async connect(
    platform: string,
    agentId: string,
    options?: Record<string, unknown>,
  ): Promise<ChannelConnectResult> {
    const channel = this.#getChannelOrThrow(platform);

    if (!channel.connect) {
      throw new Error(`Channel "${platform}" does not support programmatic connection`);
    }

    return channel.connect(agentId, options);
  }

  async disconnect(platform: string, agentId: string): Promise<void> {
    const channel = this.#getChannelOrThrow(platform);

    if (!channel.disconnect) {
      throw new Error(`Channel "${platform}" does not support programmatic disconnection`);
    }

    return channel.disconnect(agentId);
  }

  #getChannels(): Record<string, MastraChannel> {
    this.ensureRegistered();
    return this.mastra!.channels;
  }

  #getChannelOrThrow(platform: string): MastraChannel {
    const channels = this.#getChannels();
    const channel = Object.values(channels).find((c) => c.id === platform);
    if (!channel) {
      throw new Error(
        `Channel "${platform}" is not registered. Available: ${Object.values(channels)
          .map((c) => c.id)
          .join(', ') || 'none'}`,
      );
    }
    return channel;
  }
}
