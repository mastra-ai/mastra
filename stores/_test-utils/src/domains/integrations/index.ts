import type { MastraStorage, IntegrationsStorage } from '@mastra/core/storage';
import { createSampleIntegration, createFullSampleIntegration, createSampleIntegrations, createSampleCachedTool, createSampleCachedTools } from './data';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

export function createIntegrationsTests({ storage }: { storage: MastraStorage }) {
  // Skip tests if storage doesn't have integrations domain
  const describeIntegrations = storage.stores?.integrations ? describe : describe.skip;

  let integrationsStorage: IntegrationsStorage;

  describeIntegrations('Integrations Storage', () => {
    beforeAll(async () => {
      const store = await storage.getStore('integrations');
      if (!store) {
        throw new Error('Integrations storage not found');
      }
      integrationsStorage = store;

      const start = Date.now();
      console.log('Clearing integrations domain data before tests');
      await integrationsStorage.dangerouslyClearAll();
      const end = Date.now();
      console.log(`Integrations domain cleared in ${end - start}ms`);
    });

    describe('createIntegration', () => {
      it('should create and retrieve an integration', async () => {
        const integration = createSampleIntegration();

        const savedIntegration = await integrationsStorage.createIntegration({ integration });

        expect(savedIntegration.id).toBe(integration.id);
        expect(savedIntegration.name).toBe(integration.name);
        expect(savedIntegration.provider).toBe(integration.provider);
        expect(savedIntegration.enabled).toBe(integration.enabled);
        expect(savedIntegration.selectedToolkits).toEqual(integration.selectedToolkits);
        expect(savedIntegration.metadata).toEqual(integration.metadata);
        expect(savedIntegration.createdAt).toBeInstanceOf(Date);
        expect(savedIntegration.updatedAt).toBeInstanceOf(Date);

        // Retrieve and verify
        const retrievedIntegration = await integrationsStorage.getIntegrationById({ id: integration.id });
        expect(retrievedIntegration).toBeDefined();
        expect(retrievedIntegration?.name).toBe(integration.name);
        expect(retrievedIntegration?.provider).toBe(integration.provider);
      });

      it('should create integration with all optional fields', async () => {
        const integration = createFullSampleIntegration();

        const savedIntegration = await integrationsStorage.createIntegration({ integration });

        expect(savedIntegration.id).toBe(integration.id);
        expect(savedIntegration.name).toBe(integration.name);
        expect(savedIntegration.provider).toBe(integration.provider);
        expect(savedIntegration.enabled).toBe(integration.enabled);
        expect(savedIntegration.selectedToolkits).toEqual(integration.selectedToolkits);
        expect(savedIntegration.metadata).toEqual(integration.metadata);
        expect(savedIntegration.ownerId).toBe(integration.ownerId);
      });

      it('should handle integrations with minimal required fields', async () => {
        const minimalIntegration = {
          id: `integration-minimal-${randomUUID()}`,
          provider: 'composio' as const,
          name: 'Minimal Integration',
          enabled: true,
          selectedToolkits: ['github'],
        };

        const savedIntegration = await integrationsStorage.createIntegration({ integration: minimalIntegration });

        expect(savedIntegration.id).toBe(minimalIntegration.id);
        expect(savedIntegration.name).toBe(minimalIntegration.name);
        expect(savedIntegration.provider).toBe(minimalIntegration.provider);
        expect(savedIntegration.metadata).toBeUndefined();
        expect(savedIntegration.ownerId).toBeUndefined();
      });

      it('should create disabled integration', async () => {
        const integration = createSampleIntegration({ enabled: false });

        const savedIntegration = await integrationsStorage.createIntegration({ integration });

        expect(savedIntegration.enabled).toBe(false);
      });
    });

    describe('getIntegrationById', () => {
      it('should return null for non-existent integration', async () => {
        const result = await integrationsStorage.getIntegrationById({ id: 'non-existent-integration' });
        expect(result).toBeNull();
      });

      it('should retrieve an existing integration by ID', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const retrievedIntegration = await integrationsStorage.getIntegrationById({ id: integration.id });

        expect(retrievedIntegration).toBeDefined();
        expect(retrievedIntegration?.id).toBe(integration.id);
        expect(retrievedIntegration?.name).toBe(integration.name);
        expect(retrievedIntegration?.provider).toBe(integration.provider);
      });
    });

    describe('updateIntegration', () => {
      it('should update integration name', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          name: 'Updated Integration Name',
        });

        expect(updatedIntegration.name).toBe('Updated Integration Name');
        expect(updatedIntegration.provider).toBe(integration.provider); // Unchanged

        // Verify persistence
        const retrievedIntegration = await integrationsStorage.getIntegrationById({ id: integration.id });
        expect(retrievedIntegration?.name).toBe('Updated Integration Name');
      });

      it('should update enabled status', async () => {
        const integration = createSampleIntegration({ enabled: true });
        await integrationsStorage.createIntegration({ integration });

        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          enabled: false,
        });

        expect(updatedIntegration.enabled).toBe(false);
      });

      it('should update selected toolkits', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const newToolkits = ['github', 'slack', 'asana'];
        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          selectedToolkits: newToolkits,
        });

        expect(updatedIntegration.selectedToolkits).toEqual(newToolkits);
      });

      it('should merge metadata on update', async () => {
        const integration = createSampleIntegration({
          metadata: { key1: 'value1', key2: 'value2' },
        });
        await integrationsStorage.createIntegration({ integration });

        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          metadata: { key2: 'updated', key3: 'value3' },
        });

        expect(updatedIntegration.metadata).toEqual({
          key1: 'value1',
          key2: 'updated',
          key3: 'value3',
        });
      });

      it('should update multiple fields at once', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          name: 'Completely Updated Integration',
          enabled: false,
          selectedToolkits: ['new-toolkit'],
          metadata: { updated: true },
        });

        expect(updatedIntegration.name).toBe('Completely Updated Integration');
        expect(updatedIntegration.enabled).toBe(false);
        expect(updatedIntegration.selectedToolkits).toEqual(['new-toolkit']);
        expect(updatedIntegration.metadata?.updated).toBe(true);
      });

      it('should update updatedAt timestamp', async () => {
        const integration = createSampleIntegration();
        const createdIntegration = await integrationsStorage.createIntegration({ integration });
        const originalUpdatedAt = createdIntegration.updatedAt;

        // Wait a small amount to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        const updatedIntegration = await integrationsStorage.updateIntegration({
          id: integration.id,
          name: 'Updated Name',
        });

        const updatedAtTime =
          updatedIntegration.updatedAt instanceof Date
            ? updatedIntegration.updatedAt.getTime()
            : new Date(updatedIntegration.updatedAt).getTime();

        const originalAtTime =
          originalUpdatedAt instanceof Date ? originalUpdatedAt.getTime() : new Date(originalUpdatedAt).getTime();

        expect(updatedAtTime).toBeGreaterThan(originalAtTime);
      });
    });

    describe('deleteIntegration', () => {
      it('should delete an existing integration', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        await integrationsStorage.deleteIntegration({ id: integration.id });

        const retrievedIntegration = await integrationsStorage.getIntegrationById({ id: integration.id });
        expect(retrievedIntegration).toBeNull();
      });

      it('should not throw when deleting non-existent integration', async () => {
        await expect(integrationsStorage.deleteIntegration({ id: 'non-existent' })).resolves.not.toThrow();
      });
    });

    describe('listIntegrations', () => {
      beforeEach(async () => {
        await integrationsStorage.dangerouslyClearAll();
      });

      it('should list all integrations', async () => {
        const integrations = createSampleIntegrations(3);
        for (const integration of integrations) {
          await integrationsStorage.createIntegration({ integration });
        }

        const result = await integrationsStorage.listIntegrations({ page: 0, perPage: 10 });

        expect(result.integrations).toHaveLength(3);
        expect(result.total).toBe(3);
        expect(result.page).toBe(0);
      });

      it('should handle pagination', async () => {
        const integrations = createSampleIntegrations(5);
        for (const integration of integrations) {
          await integrationsStorage.createIntegration({ integration });
        }

        const page1 = await integrationsStorage.listIntegrations({ page: 0, perPage: 2 });
        expect(page1.integrations).toHaveLength(2);
        expect(page1.page).toBe(0);
        expect(page1.perPage).toBe(2);
        expect(page1.total).toBe(5);

        const page2 = await integrationsStorage.listIntegrations({ page: 1, perPage: 2 });
        expect(page2.integrations).toHaveLength(2);
        expect(page2.page).toBe(1);
      });

      it('should filter by provider', async () => {
        const composioIntegration = createSampleIntegration({ provider: 'composio' });
        const arcadeIntegration = createSampleIntegration({ provider: 'arcade' });

        await integrationsStorage.createIntegration({ integration: composioIntegration });
        await integrationsStorage.createIntegration({ integration: arcadeIntegration });

        const composioResults = await integrationsStorage.listIntegrations({
          page: 0,
          perPage: 10,
          provider: 'composio',
        });

        expect(composioResults.integrations).toHaveLength(1);
        expect(composioResults.integrations[0]?.provider).toBe('composio');
      });

      it('should filter by enabled status', async () => {
        const enabledIntegration = createSampleIntegration({ enabled: true });
        const disabledIntegration = createSampleIntegration({ enabled: false });

        await integrationsStorage.createIntegration({ integration: enabledIntegration });
        await integrationsStorage.createIntegration({ integration: disabledIntegration });

        const enabledResults = await integrationsStorage.listIntegrations({
          page: 0,
          perPage: 10,
          enabled: true,
        });

        expect(enabledResults.integrations).toHaveLength(1);
        expect(enabledResults.integrations[0]?.enabled).toBe(true);
      });

      it('should filter by ownerId', async () => {
        const ownerId1 = `owner-${randomUUID()}`;
        const ownerId2 = `owner-${randomUUID()}`;

        await integrationsStorage.createIntegration({ integration: createSampleIntegration({ ownerId: ownerId1 }) });
        await integrationsStorage.createIntegration({ integration: createSampleIntegration({ ownerId: ownerId2 }) });

        const owner1Results = await integrationsStorage.listIntegrations({
          page: 0,
          perPage: 10,
          ownerId: ownerId1,
        });

        expect(owner1Results.integrations).toHaveLength(1);
        expect(owner1Results.integrations[0]?.ownerId).toBe(ownerId1);
      });

      it('should order by createdAt descending', async () => {
        const integration1 = createSampleIntegration({ name: 'First' });
        const integration2 = createSampleIntegration({ name: 'Second' });

        await integrationsStorage.createIntegration({ integration: integration1 });
        await new Promise(resolve => setTimeout(resolve, 10));
        await integrationsStorage.createIntegration({ integration: integration2 });

        const result = await integrationsStorage.listIntegrations({
          page: 0,
          perPage: 10,
          orderBy: { field: 'createdAt', direction: 'DESC' },
        });

        expect(result.integrations[0]?.name).toBe('Second');
        expect(result.integrations[1]?.name).toBe('First');
      });

      it('should return empty array when no integrations exist', async () => {
        const result = await integrationsStorage.listIntegrations({ page: 0, perPage: 10 });

        expect(result.integrations).toHaveLength(0);
        expect(result.total).toBe(0);
      });
    });

    describe('cacheTool', () => {
      it('should cache a single tool', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tool = createSampleCachedTool(integration.id);
        const cachedTool = await integrationsStorage.cacheTool({ tool });

        expect(cachedTool.id).toBe(tool.id);
        expect(cachedTool.integrationId).toBe(integration.id);
        expect(cachedTool.toolSlug).toBe(tool.toolSlug);
        expect(cachedTool.name).toBe(tool.name);
        expect(cachedTool.inputSchema).toEqual(tool.inputSchema);
        expect(cachedTool.outputSchema).toEqual(tool.outputSchema);
        expect(cachedTool.cachedAt).toBeInstanceOf(Date);
        expect(cachedTool.updatedAt).toBeInstanceOf(Date);
      });
    });

    describe('cacheTools', () => {
      it('should cache multiple tools at once', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tools = createSampleCachedTools(integration.id, 3);
        const cachedTools = await integrationsStorage.cacheTools({ tools });

        expect(cachedTools).toHaveLength(3);
        cachedTools.forEach((cachedTool, index) => {
          expect(cachedTool.integrationId).toBe(integration.id);
          expect(cachedTool.toolSlug).toBe(tools[index]?.toolSlug);
        });
      });
    });

    describe('getCachedTool', () => {
      it('should retrieve a cached tool by ID', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tool = createSampleCachedTool(integration.id);
        await integrationsStorage.cacheTool({ tool });

        const retrievedTool = await integrationsStorage.getCachedTool({ id: tool.id });

        expect(retrievedTool).toBeDefined();
        expect(retrievedTool?.id).toBe(tool.id);
        expect(retrievedTool?.toolSlug).toBe(tool.toolSlug);
      });

      it('should return null for non-existent tool', async () => {
        const result = await integrationsStorage.getCachedTool({ id: 'non-existent-tool' });
        expect(result).toBeNull();
      });
    });

    describe('getCachedToolBySlug', () => {
      it('should retrieve a cached tool by integrationId and toolSlug', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tool = createSampleCachedTool(integration.id, { toolSlug: 'unique-tool-slug' });
        await integrationsStorage.cacheTool({ tool });

        const retrievedTool = await integrationsStorage.getCachedToolBySlug({
          integrationId: integration.id,
          toolSlug: 'unique-tool-slug',
        });

        expect(retrievedTool).toBeDefined();
        expect(retrievedTool?.toolSlug).toBe('unique-tool-slug');
        expect(retrievedTool?.integrationId).toBe(integration.id);
      });

      it('should return null for non-existent slug', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const result = await integrationsStorage.getCachedToolBySlug({
          integrationId: integration.id,
          toolSlug: 'non-existent-slug',
        });
        expect(result).toBeNull();
      });
    });

    describe('listCachedTools', () => {
      beforeEach(async () => {
        await integrationsStorage.dangerouslyClearAll();
      });

      it('should list all cached tools for an integration', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tools = createSampleCachedTools(integration.id, 3);
        await integrationsStorage.cacheTools({ tools });

        const result = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration.id,
        });

        expect(result.tools).toHaveLength(3);
        expect(result.total).toBe(3);
      });

      it('should filter by toolkitSlug', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const githubTools = createSampleCachedTools(integration.id, 2, 'github');
        const slackTools = createSampleCachedTools(integration.id, 2, 'slack');

        await integrationsStorage.cacheTools({ tools: [...githubTools, ...slackTools] });

        const result = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration.id,
          toolkitSlug: 'github',
        });

        expect(result.tools).toHaveLength(2);
        result.tools.forEach(tool => {
          expect(tool.toolkitSlug).toBe('github');
        });
      });

      it('should filter by provider', async () => {
        const composioIntegration = createSampleIntegration({ provider: 'composio' });
        const arcadeIntegration = createSampleIntegration({ provider: 'arcade' });

        await integrationsStorage.createIntegration({ integration: composioIntegration });
        await integrationsStorage.createIntegration({ integration: arcadeIntegration });

        await integrationsStorage.cacheTools({
          tools: createSampleCachedTools(composioIntegration.id, 2).map(t => ({ ...t, provider: 'composio' as const })),
        });
        await integrationsStorage.cacheTools({
          tools: createSampleCachedTools(arcadeIntegration.id, 2).map(t => ({ ...t, provider: 'arcade' as const })),
        });

        const result = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          provider: 'composio',
        });

        expect(result.tools.length).toBeGreaterThanOrEqual(2);
        result.tools.forEach(tool => {
          expect(tool.provider).toBe('composio');
        });
      });

      it('should handle pagination', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tools = createSampleCachedTools(integration.id, 5);
        await integrationsStorage.cacheTools({ tools });

        const page1 = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 2,
          integrationId: integration.id,
        });

        expect(page1.tools).toHaveLength(2);
        expect(page1.total).toBe(5);
        expect(page1.page).toBe(0);

        const page2 = await integrationsStorage.listCachedTools({
          page: 1,
          perPage: 2,
          integrationId: integration.id,
        });

        expect(page2.tools).toHaveLength(2);
        expect(page2.page).toBe(1);
      });
    });

    describe('deleteCachedToolsByIntegration', () => {
      it('should delete all cached tools for an integration', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tools = createSampleCachedTools(integration.id, 3);
        await integrationsStorage.cacheTools({ tools });

        // Verify tools exist
        const beforeDelete = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration.id,
        });
        expect(beforeDelete.tools).toHaveLength(3);

        // Delete all tools
        await integrationsStorage.deleteCachedToolsByIntegration({ integrationId: integration.id });

        // Verify tools are deleted
        const afterDelete = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration.id,
        });
        expect(afterDelete.tools).toHaveLength(0);
      });

      it('should not delete tools from other integrations', async () => {
        const integration1 = createSampleIntegration();
        const integration2 = createSampleIntegration();

        await integrationsStorage.createIntegration({ integration: integration1 });
        await integrationsStorage.createIntegration({ integration: integration2 });

        await integrationsStorage.cacheTools({ tools: createSampleCachedTools(integration1.id, 2) });
        await integrationsStorage.cacheTools({ tools: createSampleCachedTools(integration2.id, 2) });

        // Delete tools from integration1
        await integrationsStorage.deleteCachedToolsByIntegration({ integrationId: integration1.id });

        // Verify integration1 tools are deleted
        const integration1Tools = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration1.id,
        });
        expect(integration1Tools.tools).toHaveLength(0);

        // Verify integration2 tools still exist
        const integration2Tools = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration2.id,
        });
        expect(integration2Tools.tools).toHaveLength(2);
      });
    });

    describe('updateCachedToolsTimestamp', () => {
      it('should update updatedAt timestamp for all tools in an integration', async () => {
        const integration = createSampleIntegration();
        await integrationsStorage.createIntegration({ integration });

        const tools = createSampleCachedTools(integration.id, 2);
        const cachedTools = await integrationsStorage.cacheTools({ tools });
        const originalTimestamp = cachedTools[0]?.updatedAt;

        expect(originalTimestamp).toBeDefined();
        if (!originalTimestamp) return;

        // Wait to ensure different timestamp
        await new Promise(resolve => setTimeout(resolve, 10));

        // Update timestamps
        await integrationsStorage.updateCachedToolsTimestamp({ integrationId: integration.id });

        // Retrieve and verify updated timestamp
        const updatedTools = await integrationsStorage.listCachedTools({
          page: 0,
          perPage: 10,
          integrationId: integration.id,
        });

        expect(updatedTools.tools).toHaveLength(2);

        updatedTools.tools.forEach(tool => {
          const updatedAtTime = tool.updatedAt instanceof Date ? tool.updatedAt.getTime() : new Date(tool.updatedAt).getTime();
          const originalAtTime =
            originalTimestamp instanceof Date ? originalTimestamp.getTime() : new Date(originalTimestamp).getTime();

          expect(updatedAtTime).toBeGreaterThan(originalAtTime);
        });
      });
    });
  });
}
