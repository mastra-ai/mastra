import type { ChannelProvider, ChannelInstallationInfo, ChannelPlatformInfo } from '@mastra/core/channels';
import type { ApiRoute } from '@mastra/core/server';

/**
 * Minimal in-memory channel provider stub used by the smoke fixture.
 *
 * Lets us assert that /channels/platforms and /channels/:platform/installations
 * return real entries without needing a live Slack/Discord integration.
 */
class StubChannelProvider implements ChannelProvider {
  readonly id: string;
  private readonly displayName: string;
  private readonly installations: ChannelInstallationInfo[];

  constructor(id: string, displayName: string, installations: ChannelInstallationInfo[] = []) {
    this.id = id;
    this.displayName = displayName;
    this.installations = installations;
  }

  getRoutes(): ApiRoute[] {
    return [];
  }

  getInfo(): ChannelPlatformInfo {
    return {
      id: this.id,
      name: this.displayName,
      isConfigured: true,
    };
  }

  async listInstallations(): Promise<ChannelInstallationInfo[]> {
    return this.installations;
  }
}

export const smokeChannel = new StubChannelProvider('smoke-stub', 'Smoke Stub', [
  {
    id: 'smoke-stub-install-1',
    platform: 'smoke-stub',
    agentId: 'test-agent',
    status: 'active',
    displayName: 'Smoke Test Workspace',
    installedAt: new Date('2026-01-01T00:00:00Z'),
  },
]);
