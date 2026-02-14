import { describe, it, expect, beforeAll, beforeEach, inject } from 'vitest';
import { MastraClient } from '@mastra/client-js';

export interface MemoryTestConfig {
  testNameSuffix?: string;
  agentName?: string;
}

export function createMemoryTests(config: MemoryTestConfig = {}) {
  const { testNameSuffix, agentName = 'testAgent' } = config;
  const suiteName = testNameSuffix ? `Memory Client JS E2E Tests (${testNameSuffix})` : 'Memory Client JS E2E Tests';

  let client: MastraClient;
  let baseUrl: string;

  describe(suiteName, () => {
    beforeAll(async () => {
      baseUrl = inject('baseUrl');
      client = new MastraClient({ baseUrl, retries: 0 });
    });

    beforeEach(async () => {
      // Reset storage between tests for isolation
      try {
        await fetch(`${baseUrl}/e2e/reset-storage`, { method: 'POST' });
      } catch {
        // ignore
      }
    });

    describe('createMemoryThread', () => {
      it('should create a new memory thread', async () => {
        const thread = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'test-resource',
          title: 'Test Thread',
        });
        expect(thread).toBeDefined();
        expect(thread.id).toBeDefined();
        expect(thread.title).toBe('Test Thread');
        expect(thread.resourceId).toBe('test-resource');
      });

      it('should create thread with metadata', async () => {
        const thread = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'test-resource',
          title: 'Thread with Metadata',
          metadata: { key: 'value' },
        });
        expect(thread).toBeDefined();
        expect(thread.id).toBeDefined();
        expect(thread.metadata).toBeDefined();
        expect(thread.metadata?.key).toBe('value');
      });
    });

    describe('getMemoryThread', () => {
      it('should retrieve a thread by ID', async () => {
        const created = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'test-resource',
          title: 'Retrievable Thread',
        });

        const thread = client.getMemoryThread({ threadId: created.id, agentId: agentName });
        const details = await thread.get();
        expect(details).toBeDefined();
        expect(details.id).toBe(created.id);
        expect(details.title).toBe('Retrievable Thread');
      });

      it('should throw for non-existent thread', async () => {
        const thread = client.getMemoryThread({ threadId: 'nonexistent-thread-id', agentId: agentName });
        await expect(thread.get()).rejects.toThrow();
      });
    });

    describe('updateMemoryThread', () => {
      it('should update thread title', async () => {
        const created = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'test-resource',
          title: 'Original Title',
        });

        const thread = client.getMemoryThread({ threadId: created.id, agentId: agentName });
        const updated = await thread.update({ title: 'Updated Title' });
        expect(updated).toBeDefined();
        expect(updated.title).toBe('Updated Title');
      });

      it('should update thread metadata', async () => {
        const created = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'test-resource',
          title: 'Metadata Thread',
        });

        const thread = client.getMemoryThread({ threadId: created.id, agentId: agentName });
        const updated = await thread.update({ metadata: { updated: true } });
        expect(updated).toBeDefined();
        expect(updated.metadata?.updated).toBe(true);
      });
    });

    describe('listMemoryThreads', () => {
      it('should list threads for an agent', async () => {
        // Create a thread first
        await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'list-test-resource',
          title: 'List Test Thread',
        });

        const response = await client.listMemoryThreads({
          agentId: agentName,
          resourceId: 'list-test-resource',
        });
        expect(response).toBeDefined();
        expect(response.threads).toBeDefined();
        expect(Array.isArray(response.threads)).toBe(true);
        expect(response.threads.length).toBeGreaterThan(0);
      });
    });

    describe('saveMessageToMemory and listMessages', () => {
      it('should save messages and retrieve them', async () => {
        const thread = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'msg-test-resource',
          title: 'Message Thread',
        });

        await client.saveMessageToMemory({
          agentId: agentName,
          messages: [
            {
              id: 'msg-1',
              role: 'user',
              content: 'Hello from test',
              threadId: thread.id,
              resourceId: 'msg-test-resource',
              createdAt: new Date(),
              type: 'text',
            },
            {
              id: 'msg-2',
              role: 'assistant',
              content: 'Hello back from test',
              threadId: thread.id,
              resourceId: 'msg-test-resource',
              createdAt: new Date(),
              type: 'text',
            },
          ],
        });

        const threadClient = client.getMemoryThread({ threadId: thread.id, agentId: agentName });
        const messagesResponse = await threadClient.listMessages();
        expect(messagesResponse).toBeDefined();
        expect(messagesResponse.messages).toBeDefined();
        expect(messagesResponse.messages.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('deleteMemoryThread', () => {
      it('should delete a thread', async () => {
        const created = await client.createMemoryThread({
          agentId: agentName,
          resourceId: 'delete-test-resource',
          title: 'Delete Me Thread',
        });

        const thread = client.getMemoryThread({ threadId: created.id, agentId: agentName });
        const result = await thread.delete();
        expect(result).toBeDefined();

        // Verify it's gone
        await expect(thread.get()).rejects.toThrow();
      });
    });
  });
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string;
    port: number;
  }
}
