import type { InfrastructureStatusResponse } from '@mastra/client-js';

export const buildInfrastructureStatus = (
  overrides: Partial<InfrastructureStatusResponse> = {},
): InfrastructureStatusResponse => ({
  channels: {
    providers: [{ id: 'slack', name: 'Slack', isConfigured: true, routeCount: 2 }],
  },
  browser: {
    type: 'local',
    provider: 'playwright',
    env: 'development',
    registered: true,
    availableProviders: ['playwright'],
    config: [{ key: 'headless', value: 'true' }],
  },
  workspace: {
    type: 'local',
    workspaceId: 'workspace-1',
    name: 'Local workspace',
    source: 'config',
    registered: true,
    hasFilesystem: true,
    hasSandbox: false,
    filesystemProvider: 'node',
    sandboxProvider: null,
    config: [{ key: 'root', value: '/tmp/workspace' }],
  },
  registries: {
    skillsSh: { enabled: true },
  },
  ...overrides,
});
