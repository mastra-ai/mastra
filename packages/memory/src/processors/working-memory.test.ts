import { MessageList } from '@mastra/core/agent';
import type { MastraDBMessage } from '@mastra/core/memory';
import { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: workingMemoryData },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages as any, 'input');

      const result = await processor.processInput({
        messages: messages as any,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].role).toBe('system');
      expect(resultMessages[0].content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(resultMessages[0].content).toContain(workingMemoryData);
      expect(resultMessages[1].role).toBe('user');
      expect(mockStorage.getThreadById).toHaveBeenCalledWith({ threadId });
    });

    it('should inject resource-scoped working memory as system message', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'resource',
      });

      const resourceId = 'resource-456';
      const workingMemoryData = '# Project Context\n- Status: In Progress\n- Deadline: Friday';

      runtimeContext.set('MastraMemory', {
        thread: { id: 'thread-1', resourceId, title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId,
      });

      vi.mocked(mockStorage.getResourceById).mockResolvedValue({
        id: resourceId,
        workingMemory: workingMemoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the status?' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');

      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].role).toBe('system');
      expect(resultMessages[0].content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(resultMessages[0].content).toContain(workingMemoryData);
      expect(mockStorage.getResourceById).toHaveBeenCalledWith({ resourceId });
    });

    it('should use default template when no working memory exists', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].role).toBe('system');
      expect(resultMessages[0].content).toContain('WORKING_MEMORY_SYSTEM_INSTRUCTION');
      expect(resultMessages[0].content).toContain('# User Information');
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

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages[0].content).toContain('# Custom Template');
      expect(resultMessages[0].content).toContain('- Field 1:');
    });

    it('should use VNext instruction format when useVNext is true', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
        useVNext: true,
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: 'Some data' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages[0].content).toContain('If your memory has not changed');
      expect(resultMessages[0].content).toContain('Information not being relevant to the current conversation');
    });

    it('should return original messages when no threadId or resourceId', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext: new RequestContext(),
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].role).toBe('user');
      expect(mockStorage.getThreadById).not.toHaveBeenCalled();
      expect(mockStorage.getResourceById).not.toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockRejectedValue(new Error('Storage error'));

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      // Should return original messages on error

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(1);
      expect(resultMessages[0].role).toBe('user');
    });
    it('should default to resource scope when scope not specified', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        // scope not specified, should default to 'resource'
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getResourceById).mockResolvedValue({
        id: 'resource-1',
        workingMemory: 'Test data',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(2);
      expect(mockStorage.getResourceById).toHaveBeenCalledWith({ resourceId: 'resource-1' });
      expect(mockStorage.getThreadById).not.toHaveBeenCalled();
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

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: null },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages[0].content).toContain('Use JSON format for all data');
      expect(resultMessages[0].content).not.toContain('IMPORTANT: When calling updateWorkingMemory');
    });

    it('should prepend working memory before existing messages', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: 'Test data' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'First message' }] },
          createdAt: new Date(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: { format: 2, parts: [{ type: 'text', text: 'Second message' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(3);
      expect(resultMessages[0].role).toBe('system');
      expect(resultMessages[1].role).toBe('user');
      expect(resultMessages[2].role).toBe('assistant');
    });

    it('should handle empty working memory data', async () => {
      const processor = new WorkingMemory({
        storage: mockStorage,
        scope: 'thread',
      });

      const threadId = 'thread-123';

      runtimeContext.set('MastraMemory', {
        thread: { id: threadId, resourceId: 'resource-1', title: 'Test', createdAt: new Date(), updatedAt: new Date() },
        resourceId: 'resource-1',
      });

      vi.mocked(mockStorage.getThreadById).mockResolvedValue({
        id: threadId,
        resourceId: 'resource-1',
        title: 'Test Thread',
        metadata: { workingMemory: '' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'input');
      const result = await processor.processInput({
        messages,
        messageList,
        abort: () => {
          throw new Error('Aborted');
        },
        runtimeContext,
      });

      const resultMessages = result instanceof MessageList ? result.get.all.aiV5.prompt() : result;
      expect(resultMessages).toHaveLength(2);
      expect(resultMessages[0].role).toBe('system');
      expect(resultMessages[0].content).toContain('<working_memory_data>');
      expect(resultMessages[0].content).toContain('</working_memory_data>');
    });
  });
});
