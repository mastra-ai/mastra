import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { MemoryRuntimeContext } from '../../memory/types';
import type { MastraMessageV2 } from '../../message';
import { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';

import type { WorkingMemoryTemplate } from './working-memory';
import { WorkingMemory } from './working-memory';

describe('WorkingMemory', () => {
  let mockStorage: MemoryStorage;
  let runtimeContext: RequestContext;

  beforeEach(() => {
    mockStorage = {
      getThreadById: vi.fn(),
      getResourceById: vi.fn(),
    } as any;

    runtimeContext = new RequestContext();
  });

  describe('Input Processing', () => {
    it('should inject thread-scoped working memory as system message', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';
      const workingMemoryData = '# User Info\n- Name: John\n- Preference: Dark mode';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: workingMemoryData,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content.content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(result[0].content.content).toContain(workingMemoryData);
      expect(result[1]).toEqual(messages[0]);
      expect(mockStorage.getThreadById).toHaveBeenCalledWith({ threadId });
    });

    it('should inject resource-scoped working memory as system message', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'resource',
      });

      const resourceId = 'resource-456';
      const workingMemoryData = '# Project Context\n- Status: In Progress\n- Deadline: Friday';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: 'thread-1', resourceId, title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId,
      });

      vi.mocked(mockStorage.getResourceById).mockResolvedValue({
        id: resourceId,
        name: 'Test Resource',
        workingMemory: workingMemoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'What is the status?',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content.content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(result[0].content.content).toContain(workingMemoryData);
      expect(mockStorage.getResourceById).toHaveBeenCalledWith({ resourceId });
    });

    it('should use default template when no working memory exists', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content.content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(result[0].content.content).toContain('# Working Memory');
      expect(result[0].content.content).toContain('## User Information');
    });

    it('should use custom template when provided', async () => {
      const customTemplate: WorkingMemoryTemplate = {
        format: 'markdown',
        content: '# Custom Template\n- Field 1:\n- Field 2:',
      };

      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
        template: customTemplate,
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result[0].content.content).toContain('# Custom Template');
      expect(result[0].content.content).toContain('- Field 1:');
    });

    it('should use VNext instruction format when useVNext is true', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
        useVNext: true,
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: 'Some data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result[0].content.content).toContain('If your memory has not changed');
      expect(result[0].content.content).toContain('Information not being relevant to the current conversation');
    });

    it('should return original messages when no threadId or resourceId', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext: new RequestContext(),
      });

      expect(result).toEqual(messages);
      expect(mockStorage.getThreadById).not.toHaveBeenCalled();
      expect(mockStorage.getResourceById).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockRejectedValue(new Error('Storage error'));

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      // Should return original messages on error
      expect(result).toEqual(messages);
    });

    it('should default to thread scope when scope not specified', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        // scope not specified, should default to 'thread'
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: 'Test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(2);
      expect(mockStorage.getThreadById).toHaveBeenCalledWith({ threadId });
      expect(mockStorage.getResourceById).not.toHaveBeenCalled();
    });

    it('should handle JSON format template', async () => {
      const jsonTemplate: WorkingMemoryTemplate = {
        format: 'json',
        content: JSON.stringify({
          user: { name: '', email: '' },
          preferences: { theme: '', language: '' },
        }),
      };

      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
        template: jsonTemplate,
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: null,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result[0].content.content).toContain('Use JSON format for all data');
      expect(result[0].content.content).not.toContain('IMPORTANT: When calling updateWorkingMemory');
    });

    it('should prepend working memory before existing messages', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: {
          workingMemory: 'Test data',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'First message',
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(3);
      expect(result[0].role).toBe('system');
      expect(result[1]).toEqual(messages[0]);
      expect(result[2]).toEqual(messages[1]);
    });

    it('should handle empty working memory data', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set<MemoryRuntimeContext>('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        workingMemory: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraMessageV2[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          createdAt: new Date(),
        },
      ];

      const result = await processor.processInput({
        messages,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      expect(result).toHaveLength(2);
      expect(result[0].role).toBe('system');
      expect(result[0].content.content).toContain('<working_memory_data>');
      expect(result[0].content.content).toContain('</working_memory_data>');
    });
  });
});
