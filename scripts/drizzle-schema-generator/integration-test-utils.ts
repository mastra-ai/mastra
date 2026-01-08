/**
 * Shared integration test utilities for Drizzle schemas.
 *
 * Provides a test factory that runs standard integration tests
 * against any Drizzle database instance.
 *
 * Note: The `as any` casts on column references are necessary because Drizzle's
 * type system is too complex to represent generically across different drivers.
 */

import { describe, it, expect, afterEach } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { eq } = require('drizzle-orm') as { eq: (left: unknown, right: unknown) => unknown };

interface TestableSchema {
  mastraThreads: {
    id: unknown;
    resourceId: unknown;
    title: unknown;
    createdAt: unknown;
    updatedAt: unknown;
  };
  mastraMessages: {
    id: unknown;
    threadId: unknown;
    content: unknown;
    role: unknown;
    type: unknown;
    createdAt: unknown;
  };
}

/** Run standard Drizzle integration tests against any database instance. */
export function describeDrizzleIntegration<
  TDb extends {
    insert(table: unknown): { values(data: unknown): Promise<unknown> };
    select(fields?: unknown): {
      from(table: unknown): {
        where(condition: unknown): Promise<unknown[]>;
        innerJoin(table: unknown, on: unknown): { where(condition: unknown): Promise<unknown[]> };
      };
    };
    delete(table: unknown): { where(condition: unknown): Promise<unknown> };
  },
  TSchema extends TestableSchema,
>(getDb: () => TDb, schema: TSchema, suffix?: string): void {
  const suiteName = suffix ? `Drizzle integration (${suffix})` : 'Drizzle integration';
  const testIds: string[] = [];

  afterEach(async () => {
    const db = getDb();
    // Clean up test data
    for (const id of testIds) {
      try {
        await db.delete(schema.mastraMessages).where(eq(schema.mastraMessages.threadId as any, id));
        await db.delete(schema.mastraThreads).where(eq(schema.mastraThreads.id as any, id));
      } catch (e) {
        console.warn(`Test cleanup failed for ${id}:`, e);
      }
    }
    testIds.length = 0;
  });

  describe(suiteName, () => {
    it('can insert and query threads', async () => {
      const db = getDb();
      const testId = `drizzle-test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      testIds.push(testId);

      await db.insert(schema.mastraThreads).values({
        id: testId,
        resourceId: 'test-resource',
        title: 'Drizzle Integration Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const results = await db
        .select()
        .from(schema.mastraThreads)
        .where(eq(schema.mastraThreads.id as any, testId));
      const thread = results[0] as Record<string, unknown>;

      expect(thread).toBeDefined();
      expect(thread.id).toBe(testId);
      expect(thread.title).toBe('Drizzle Integration Test');
      expect(thread.resourceId).toBe('test-resource');
    });

    it('can insert and query messages', async () => {
      const db = getDb();
      const threadId = `drizzle-test-thread-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const messageId = `drizzle-test-msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      testIds.push(threadId);

      // Create thread first
      await db.insert(schema.mastraThreads).values({
        id: threadId,
        resourceId: 'test-resource',
        title: 'Thread for Messages Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Insert message
      await db.insert(schema.mastraMessages).values({
        id: messageId,
        threadId: threadId,
        content: JSON.stringify({ text: 'Hello from Drizzle' }),
        role: 'user',
        type: 'text',
        createdAt: new Date().toISOString(),
      });

      const results = await db
        .select()
        .from(schema.mastraMessages)
        .where(eq(schema.mastraMessages.id as any, messageId));
      const message = results[0] as Record<string, unknown>;

      expect(message).toBeDefined();
      expect(message.threadId).toBe(threadId);
      expect(message.role).toBe('user');
    });

    it('can perform joins between threads and messages', async () => {
      const db = getDb();
      const threadId = `drizzle-test-join-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const messageId = `drizzle-test-join-msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      testIds.push(threadId);

      await db.insert(schema.mastraThreads).values({
        id: threadId,
        resourceId: 'join-test-resource',
        title: 'Join Test Thread',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.insert(schema.mastraMessages).values({
        id: messageId,
        threadId: threadId,
        content: JSON.stringify({ text: 'Join test message' }),
        role: 'assistant',
        type: 'text',
        createdAt: new Date().toISOString(),
      });

      const results = await db
        .select({
          threadTitle: schema.mastraThreads.title,
          messageRole: schema.mastraMessages.role,
        })
        .from(schema.mastraThreads)
        .innerJoin(schema.mastraMessages, eq(schema.mastraThreads.id as any, schema.mastraMessages.threadId as any))
        .where(eq(schema.mastraThreads.id as any, threadId));

      expect(results).toHaveLength(1);
      const result = results[0] as Record<string, unknown>;
      expect(result.threadTitle).toBe('Join Test Thread');
      expect(result.messageRole).toBe('assistant');
    });
  });
}
