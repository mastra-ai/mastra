import type { MastraStorage } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { createSampleResource } from './data';
import { randomUUID } from 'crypto';

export function createResourcesTest({ storage }: { storage: MastraStorage }) {
  describe('Resources', () => {
    it('should create and retrieve a resource', async () => {
      const resource = createSampleResource();

      // Save resource
      const savedResource = await storage.saveResource({ resource });
      expect(savedResource).toEqual(resource);

      // Retrieve resource
      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.id).toEqual(resource.id);
      expect(retrievedResource?.workingMemory).toEqual(resource.workingMemory);
      expect(retrievedResource?.metadata).toEqual(resource.metadata);
    });

    it('should create and retrieve a resource with specific ID and dates', async () => {
      const exampleResourceId = '1346362547862769664';
      const createdAt = new Date('2023-01-01T00:00:00Z');
      const resource = createSampleResource({
        id: exampleResourceId,
        workingMemory: 'Custom working memory',
        metadata: { custom: 'data', version: 1 },
        date: createdAt,
      });

      // Save resource
      const savedResource = await storage.saveResource({ resource });
      expect(savedResource.id).toEqual(exampleResourceId);
      expect(savedResource.workingMemory).toEqual('Custom working memory');
      expect(savedResource.metadata).toEqual({ custom: 'data', version: 1 });

      // Retrieve resource
      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.id).toEqual(exampleResourceId);
      expect(retrievedResource?.workingMemory).toEqual('Custom working memory');
      expect(retrievedResource?.metadata).toEqual({ custom: 'data', version: 1 });

      // Check date handling
      if (retrievedResource?.createdAt instanceof Date) {
        expect(retrievedResource.createdAt.toISOString()).toEqual(createdAt.toISOString());
      } else {
        expect(retrievedResource?.createdAt).toEqual(createdAt.toISOString());
      }
    });

    it('should return null for non-existent resource', async () => {
      const result = await storage.getResourceById({ resourceId: 'non-existent' });
      expect(result).toBeNull();
    });

    it('should update resource workingMemory and metadata', async () => {
      const resource = createSampleResource();
      await storage.saveResource({ resource });

      const newWorkingMemory = 'Updated working memory content';
      const newMetadata = { newKey: 'newValue', updated: true };

      const updatedResource = await storage.updateResource({
        resourceId: resource.id,
        workingMemory: newWorkingMemory,
        metadata: newMetadata,
      });

      expect(updatedResource.workingMemory).toBe(newWorkingMemory);
      expect(updatedResource.metadata).toEqual({
        ...resource.metadata,
        ...newMetadata,
      });

      // Verify persistence
      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.workingMemory).toBe(newWorkingMemory);
      expect(retrievedResource?.metadata).toEqual({
        ...resource.metadata,
        ...newMetadata,
      });
    });

    it('should update only workingMemory when metadata is not provided', async () => {
      const resource = createSampleResource();
      await storage.saveResource({ resource });

      const newWorkingMemory = 'Updated working memory only';
      const originalMetadata = resource.metadata;

      const updatedResource = await storage.updateResource({
        resourceId: resource.id,
        workingMemory: newWorkingMemory,
      });

      expect(updatedResource.workingMemory).toBe(newWorkingMemory);
      expect(updatedResource.metadata).toEqual(originalMetadata);

      // Verify persistence
      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.workingMemory).toBe(newWorkingMemory);
      expect(retrievedResource?.metadata).toEqual(originalMetadata);
    });

    it('should update only metadata when workingMemory is not provided', async () => {
      const resource = createSampleResource();
      await storage.saveResource({ resource });

      const newMetadata = { onlyMetadata: 'updated' };
      const originalWorkingMemory = resource.workingMemory;

      const updatedResource = await storage.updateResource({
        resourceId: resource.id,
        metadata: newMetadata,
      });

      expect(updatedResource.workingMemory).toBe(originalWorkingMemory);
      expect(updatedResource.metadata).toEqual({
        ...resource.metadata,
        ...newMetadata,
      });

      // Verify persistence
      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.workingMemory).toBe(originalWorkingMemory);
      expect(retrievedResource?.metadata).toEqual({
        ...resource.metadata,
        ...newMetadata,
      });
    });

    it('should create new resource when updating non-existent resource', async () => {
      const nonExistentId = `resource-${randomUUID()}`;
      const newWorkingMemory = 'New working memory';
      const newMetadata = { created: true, source: 'update' };

      const createdResource = await storage.updateResource({
        resourceId: nonExistentId,
        workingMemory: newWorkingMemory,
        metadata: newMetadata,
      });

      expect(createdResource.id).toBe(nonExistentId);
      expect(createdResource.workingMemory).toBe(newWorkingMemory);
      expect(createdResource.metadata).toEqual(newMetadata);

      // Verify it was actually created
      const retrievedResource = await storage.getResourceById({ resourceId: nonExistentId });
      expect(retrievedResource?.id).toBe(nonExistentId);
      expect(retrievedResource?.workingMemory).toBe(newWorkingMemory);
      expect(retrievedResource?.metadata).toEqual(newMetadata);
    });

    it('should handle empty workingMemory', async () => {
      const resource = createSampleResource({
        workingMemory: '',
      });

      const savedResource = await storage.saveResource({ resource });
      expect(savedResource.workingMemory).toBe('');

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.workingMemory).toBe('');
    });

    it('should handle null/undefined workingMemory', async () => {
      const resource = {
        id: `resource-${randomUUID()}`,
        workingMemory: undefined,
        metadata: { key: 'value', test: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedResource = await storage.saveResource({ resource });
      expect(!!savedResource.workingMemory).toBe(false);

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(!!retrievedResource?.workingMemory).toBe(false);
    });

    it('should handle empty metadata', async () => {
      const resource = createSampleResource({
        metadata: {},
      });

      const savedResource = await storage.saveResource({ resource });
      expect(savedResource.metadata).toEqual({});

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.metadata).toEqual({});
    });

    it('should handle null/undefined metadata', async () => {
      const resource = {
        id: `resource-${randomUUID()}`,
        workingMemory: 'Sample working memory content',
        metadata: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const savedResource = await storage.saveResource({ resource });
      expect(!!savedResource.metadata).toBe(false);

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(!!retrievedResource?.metadata).toBe(false);
    });

    it('should handle complex metadata structures', async () => {
      const complexMetadata = {
        nested: {
          object: {
            with: {
              arrays: [1, 2, 3],
              strings: ['a', 'b', 'c'],
              numbers: 42,
              booleans: true,
              nulls: null,
            },
          },
        },
        array: [1, 2, 3, { nested: 'value' }],
        mixed: {
          string: 'test',
          number: 123,
          boolean: false,
          null: null,
        },
      };

      const resource = createSampleResource({
        metadata: complexMetadata,
      });

      const savedResource = await storage.saveResource({ resource });
      expect(savedResource.metadata).toEqual(complexMetadata);

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.metadata).toEqual(complexMetadata);
    });

    it('should handle large workingMemory content', async () => {
      const largeWorkingMemory = 'A'.repeat(10000); // 10KB of content
      const resource = createSampleResource({
        workingMemory: largeWorkingMemory,
      });

      const savedResource = await storage.saveResource({ resource });
      expect(savedResource.workingMemory).toBe(largeWorkingMemory);

      const retrievedResource = await storage.getResourceById({ resourceId: resource.id });
      expect(retrievedResource?.workingMemory).toBe(largeWorkingMemory);
    });

    it('should update resource updatedAt timestamp', async () => {
      const resource = createSampleResource();
      await storage.saveResource({ resource });

      // Get the initial resource to capture the original updatedAt
      const initialResource = await storage.getResourceById({ resourceId: resource.id });
      expect(initialResource).toBeDefined();
      const originalUpdatedAt = initialResource!.updatedAt;

      // Wait a small amount to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the resource
      const updatedResource = await storage.updateResource({
        resourceId: resource.id,
        workingMemory: 'Updated content',
      });

      let originalUpdatedAtTime: number;
      if (updatedResource.updatedAt instanceof Date) {
        originalUpdatedAtTime = originalUpdatedAt.getTime();
      } else {
        originalUpdatedAtTime = new Date(originalUpdatedAt).getTime();
      }

      if (updatedResource.updatedAt instanceof Date) {
        expect(updatedResource.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAtTime);
      } else {
        expect(new Date(updatedResource.updatedAt).getTime()).toBeGreaterThan(originalUpdatedAtTime);
      }
    });

    it('should handle concurrent updates to the same resource', async () => {
      const resource = createSampleResource();
      await storage.saveResource({ resource });

      // Perform concurrent updates
      const updatePromises = [
        storage.updateResource({
          resourceId: resource.id,
          workingMemory: 'Update 1',
          metadata: { update: 1 },
        }),
        storage.updateResource({
          resourceId: resource.id,
          workingMemory: 'Update 2',
          metadata: { update: 2 },
        }),
        storage.updateResource({
          resourceId: resource.id,
          workingMemory: 'Update 3',
          metadata: { update: 3 },
        }),
      ];

      const results = await Promise.all(updatePromises);

      // All updates should succeed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.id).toBe(resource.id);
      });

      // Final state should be consistent
      const finalResource = await storage.getResourceById({ resourceId: resource.id });
      expect(finalResource).toBeDefined();
      expect(finalResource?.id).toBe(resource.id);
    });
  });
}
