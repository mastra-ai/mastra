import { createTestSuite } from '@internal/storage-test-utils';
import { Redis } from '@upstash/redis';
import { describe, expect, it, vi } from 'vitest';
import { UpstashStore } from './index';

// Increase timeout for all tests in this file to 30 seconds
vi.setConfig({ testTimeout: 200_000, hookTimeout: 200_000 });

const TEST_CONFIG = {
  url: 'http://localhost:8079',
  token: 'test_token',
};

createTestSuite(
  new UpstashStore({
    id: 'upstash-test-store',
    ...TEST_CONFIG,
  }),
);

describe('UpstashStore with pre-configured client', () => {
  it('should accept a pre-configured Redis client', () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const store = new UpstashStore({
      id: 'upstash-client-test',
      client,
    });

    expect(store).toBeDefined();
    expect(store.name).toBe('Upstash');
  });

  it('should work with pre-configured client for storage operations', async () => {
    const client = new Redis({
      url: TEST_CONFIG.url,
      token: TEST_CONFIG.token,
    });

    const store = new UpstashStore({
      id: 'upstash-client-ops-test',
      client,
    });

    await store.init();

    // Test a basic operation
    const thread = {
      id: `thread-client-test-${Date.now()}`,
      resourceId: 'test-resource',
      title: 'Test Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const savedThread = await store.saveThread({ thread });
    expect(savedThread.id).toBe(thread.id);

    const retrievedThread = await store.getThreadById({ threadId: thread.id });
    expect(retrievedThread).toBeDefined();
    expect(retrievedThread?.title).toBe('Test Thread');

    // Clean up
    await store.deleteThread({ threadId: thread.id });
  });
});

describe('UpstashStore Configuration Validation', () => {
  describe('with URL/token config', () => {
    it('should throw if url is empty', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: '',
            token: 'test-token',
          }),
      ).toThrow(/url is required/i);
    });

    it('should throw if token is empty', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: '',
          }),
      ).toThrow(/token is required/i);
    });

    it('should accept valid URL/token config', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: 'test-token',
          }),
      ).not.toThrow();
    });
  });

  describe('with pre-configured client', () => {
    it('should accept a Redis client', () => {
      const client = new Redis({
        url: 'http://localhost:8079',
        token: 'test-token',
      });

      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            client,
          }),
      ).not.toThrow();
    });
  });

  describe('disableInit option', () => {
    it('should accept disableInit: true with URL config', () => {
      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            url: 'http://localhost:8079',
            token: 'test-token',
            disableInit: true,
          }),
      ).not.toThrow();
    });

    it('should accept disableInit: true with client config', () => {
      const client = new Redis({
        url: 'http://localhost:8079',
        token: 'test-token',
      });

      expect(
        () =>
          new UpstashStore({
            id: 'test-store',
            client,
            disableInit: true,
          }),
      ).not.toThrow();
    });
  });
});
