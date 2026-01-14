import type {
  StorageIntegrationConfig,
  StorageCachedTool,
  StorageCreateIntegrationInput,
} from '@mastra/core/storage';
import { randomUUID } from 'node:crypto';

/**
 * Creates a sample integration configuration for testing
 */
export function createSampleIntegration(overrides?: Partial<StorageCreateIntegrationInput>): StorageCreateIntegrationInput {
  return {
    id: `integration-${randomUUID()}`,
    provider: 'composio',
    name: 'Test Composio Integration',
    enabled: true,
    selectedToolkits: ['github', 'slack'],
    metadata: {
      description: 'Test integration for GitHub and Slack',
    },
    ...overrides,
  };
}

/**
 * Creates a full sample integration with all optional fields
 */
export function createFullSampleIntegration(overrides?: Partial<StorageCreateIntegrationInput>): StorageCreateIntegrationInput {
  return {
    id: `integration-full-${randomUUID()}`,
    provider: 'arcade',
    name: 'Full Test Integration',
    enabled: true,
    selectedToolkits: ['productivity', 'communication', 'analytics'],
    metadata: {
      description: 'Full test integration with all fields',
      category: 'test',
      tags: ['test', 'full'],
      configVersion: '1.0',
    },
    ownerId: `owner-${randomUUID()}`,
    ...overrides,
  };
}

/**
 * Creates multiple sample integrations
 */
export function createSampleIntegrations(count: number = 3): StorageCreateIntegrationInput[] {
  return Array.from({ length: count }, (_, i) =>
    createSampleIntegration({
      id: `integration-${i}-${randomUUID()}`,
      name: `Test Integration ${i + 1}`,
      provider: i % 2 === 0 ? 'composio' : 'arcade',
      selectedToolkits: i % 2 === 0 ? ['github'] : ['slack'],
    })
  );
}

/**
 * Creates a sample cached tool for testing
 */
export function createSampleCachedTool(integrationId: string, overrides?: Partial<StorageCachedTool>): Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'> {
  const toolSlug = overrides?.toolSlug || `tool-${randomUUID()}`;
  const provider = overrides?.provider || 'composio';
  const toolkitSlug = overrides?.toolkitSlug || 'github';

  return {
    id: `cached-tool-${randomUUID()}`,
    integrationId,
    provider,
    toolkitSlug,
    toolSlug,
    name: overrides?.name || `Test Tool ${toolSlug}`,
    description: overrides?.description || 'A test tool for integration testing',
    inputSchema: overrides?.inputSchema || {
      type: 'object',
      properties: {
        param1: { type: 'string', description: 'Parameter 1' },
        param2: { type: 'number', description: 'Parameter 2' },
      },
      required: ['param1'],
    },
    outputSchema: overrides?.outputSchema || {
      type: 'object',
      properties: {
        result: { type: 'string' },
      },
    },
    rawDefinition: overrides?.rawDefinition || {
      api_endpoint: '/test/endpoint',
      method: 'POST',
      auth_required: true,
    },
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Creates multiple cached tools for an integration
 */
export function createSampleCachedTools(
  integrationId: string,
  count: number = 3,
  toolkitSlug: string = 'github'
): Array<Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'>> {
  return Array.from({ length: count }, (_, i) =>
    createSampleCachedTool(integrationId, {
      toolSlug: `tool-${i}-${randomUUID()}`,
      name: `GitHub Tool ${i + 1}`,
      toolkitSlug,
      description: `Test tool ${i + 1} from ${toolkitSlug}`,
    })
  );
}
