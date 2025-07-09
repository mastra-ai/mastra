import type { StorageThreadType, MastraMessageV2, Trace } from '@mastra/core';
import { ConvexHttpClient } from 'convex/browser';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConvexStorage } from './index';

// Mock the ConvexHttpClient
vi.mock('convex/browser', () => {
  return {
    ConvexHttpClient: vi.fn().mockImplementation(() => ({
      query: vi.fn(),
      mutation: vi.fn(),
      onQuery: vi.fn().mockImplementation(() => ({
        localQueryLogs: {
          clear: vi.fn(),
        },
      })),
    })),
  };
});

describe('ConvexStorage', () => {
  let storage: ConvexStorage;
  let mockClient: ConvexHttpClient;
  let mockApi: any;

  // Sample test data
  const sampleThread: StorageThreadType = {
    id: 'thread_123',
    resourceId: 'resource_123',
    title: 'Test Thread',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  };

  const sampleMessage: MastraMessageV2 = {
    id: 'message_123',
    threadId: 'thread_123',
    messageType: 'assistant',
    content: {
      content: 'Test content',
      metadata: {},
    },
    createdAt: new Date(),
  };

  const sampleTrace: Trace = {
    id: 'trace_123',
    threadId: 'thread_123',
    transportId: 'transport_123',
    runId: 'run_123',
    rootRunId: 'root_run_123',
    timestamp: new Date(),
    properties: {},
    spans: [],
    spanDurations: {},
  };

  beforeEach(() => {
    // Create mock API with all required methods
    mockApi = {
      threads: {
        getById: 'threads.getById',
        getByResourceId: 'threads.getByResourceId',
        save: 'threads.save',
        update: 'threads.update',
      },
      messages: {
        get: 'messages.get',
        getByThreadId: 'messages.getByThreadId',
        save: 'messages.save',
        update: 'messages.update',
      },
      traces: {
        getByThreadId: 'traces.getByThreadId',
        save: 'traces.save',
        getPaginated: 'traces.getPaginated',
      },
      evals: {
        save: 'evals.save',
        get: 'evals.get',
        getByThreadId: 'evals.getByThreadId',
      },
      workflowRuns: {
        get: 'workflowRuns.get',
        save: 'workflowRuns.save',
      },
    };

    // Create storage with mock client and API
    storage = new ConvexStorage({
      convexUrl: 'https://test.convex.dev',
      api: mockApi,
    });

    // Get the mocked client instance
    mockClient = (ConvexHttpClient as unknown as jest.Mock).mock.results[0].value;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getThreadById', () => {
    it('should return a thread when found', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce(sampleThread);

      // Execute method
      const result = await storage.getThreadById({ threadId: 'thread_123' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.threads.getById, { threadId: 'thread_123' });
      expect(result).toEqual(sampleThread);
    });

    it('should return null when thread is not found', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce(null);

      // Execute method
      const result = await storage.getThreadById({ threadId: 'non_existent' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.threads.getById, { threadId: 'non_existent' });
      expect(result).toBeNull();
    });
  });

  describe('getThreadsByResourceId', () => {
    it('should return threads for a resource', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce([sampleThread]);

      // Execute method
      const result = await storage.getThreadsByResourceId({ resourceId: 'resource_123' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.threads.getByResourceId, { resourceId: 'resource_123' });
      expect(result).toEqual([sampleThread]);
    });

    it('should return empty array when no threads are found', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce([]);

      // Execute method
      const result = await storage.getThreadsByResourceId({ resourceId: 'non_existent' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.threads.getByResourceId, { resourceId: 'non_existent' });
      expect(result).toEqual([]);
    });
  });

  describe('saveThread', () => {
    it('should save a thread', async () => {
      // Setup mock implementation
      mockClient.mutation.mockResolvedValueOnce(sampleThread);

      // Execute method
      const result = await storage.saveThread({ thread: sampleThread });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.threads.save, { thread: sampleThread });
      expect(result).toEqual(sampleThread);
    });
  });

  describe('updateThread', () => {
    it('should update a thread', async () => {
      // Setup mock implementation
      const updatedThread = { ...sampleThread, title: 'Updated Title' };
      mockClient.mutation.mockResolvedValueOnce(updatedThread);

      // Execute method
      const result = await storage.updateThread({
        id: 'thread_123',
        title: 'Updated Title',
        metadata: { key: 'value' },
      });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.threads.update, {
        id: 'thread_123',
        title: 'Updated Title',
        metadata: { key: 'value' },
      });
      expect(result).toEqual(updatedThread);
    });
  });

  describe('getMessage', () => {
    it('should get a message by id', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce(sampleMessage);

      // Execute method
      const result = await storage.getMessage({ id: 'message_123' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.messages.get, { id: 'message_123' });
      expect(result).toEqual(sampleMessage);
    });
  });

  describe('getMessages', () => {
    it('should get messages for a thread', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce([sampleMessage]);

      // Execute method
      const result = await storage.getMessages({ threadId: 'thread_123' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.messages.getByThreadId, { threadId: 'thread_123' });
      expect(result).toEqual([sampleMessage]);
    });
  });

  describe('saveMessage', () => {
    it('should save a message', async () => {
      // Setup mock implementation
      mockClient.mutation.mockResolvedValueOnce(sampleMessage);

      // Execute method
      const result = await storage.saveMessage({ message: sampleMessage });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.messages.save, { message: sampleMessage });
      expect(result).toEqual(sampleMessage);
    });
  });

  describe('updateMessages', () => {
    it('should update multiple messages', async () => {
      // Setup mock implementation
      const messageUpdate = {
        id: 'message_123',
        content: {
          metadata: { updated: true },
        },
      };
      const updatedMessage = { ...sampleMessage, content: { ...sampleMessage.content, metadata: { updated: true } } };
      mockClient.mutation.mockResolvedValueOnce([updatedMessage]);

      // Execute method
      const result = await storage.updateMessages({
        messages: [messageUpdate],
      });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.messages.update, { messages: [messageUpdate] });
      expect(result).toEqual([updatedMessage]);
    });
  });

  describe('saveMessages', () => {
    it('should save multiple messages', async () => {
      // Setup mock implementation
      mockClient.mutation.mockResolvedValueOnce([sampleMessage]);

      // Execute method
      const result = await storage.saveMessages({
        messages: [sampleMessage],
      });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.messages.save, { messages: [sampleMessage] });
      expect(result).toEqual([sampleMessage]);
    });
  });

  describe('saveTrace', () => {
    it('should save a trace', async () => {
      // Setup mock implementation
      mockClient.mutation.mockResolvedValueOnce(sampleTrace);

      // Execute method
      const result = await storage.saveTrace({ trace: sampleTrace });

      // Verify results
      expect(mockClient.mutation).toHaveBeenCalledWith(mockApi.traces.save, { trace: sampleTrace });
      expect(result).toEqual(sampleTrace);
    });
  });

  describe('getTracesByThreadId', () => {
    it('should get traces for a thread', async () => {
      // Setup mock implementation
      mockClient.query.mockResolvedValueOnce([sampleTrace]);

      // Execute method
      const result = await storage.getTracesByThreadId({ threadId: 'thread_123' });

      // Verify results
      expect(mockClient.query).toHaveBeenCalledWith(mockApi.traces.getByThreadId, { threadId: 'thread_123' });
      expect(result).toEqual([sampleTrace]);
    });
  });

  // Tests for real-time subscriptions
  describe('subscriptions', () => {
    it('should subscribe to thread updates', () => {
      // Setup mock callback
      const callback = vi.fn();

      // Execute subscription
      const unsubscribe = storage.subscribeToThread('thread_123', callback);

      // Verify subscription setup
      expect(mockClient.onQuery).toHaveBeenCalledWith(mockApi.threads.getById, { threadId: 'thread_123' }, callback);

      // Test unsubscribe function
      unsubscribe();
      expect(mockClient.onQuery.mock.results[0].value.localQueryLogs.clear).toHaveBeenCalled();
    });

    it('should subscribe to thread messages', () => {
      // Setup mock callback
      const callback = vi.fn();

      // Execute subscription
      const unsubscribe = storage.subscribeToThreadMessages('thread_123', callback);

      // Verify subscription setup
      expect(mockClient.onQuery).toHaveBeenCalledWith(
        mockApi.messages.getByThreadId,
        { threadId: 'thread_123' },
        callback,
      );

      // Test unsubscribe function
      unsubscribe();
      expect(mockClient.onQuery.mock.results[0].value.localQueryLogs.clear).toHaveBeenCalled();
    });
  });
});
