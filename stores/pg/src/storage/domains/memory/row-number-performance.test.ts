/**
 * Performance test to demonstrate the ROW_NUMBER() query performance issue
 * described in GitHub Issue #11150.
 *
 * The issue: When using semantic recall, the _getIncludedMessages method
 * generates a ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) query for each
 * included message. This becomes extremely slow on large tables because:
 *
 * 1. The ROW_NUMBER() window function must scan all messages in the thread
 *    to assign row numbers
 * 2. Each included message generates a separate CTE + subquery
 * 3. With semantic recall returning multiple messages (default topK=4),
 *    multiple expensive CTEs are UNION ALL'd together
 *
 * Expected: < 500ms for listMessages with include parameter
 * Actual (on 1M+ row tables): 5-10+ minutes, blocking queries
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgresStore } from '../../index';

describe('ROW_NUMBER Performance Issue #11150', () => {
  let store: PostgresStore;
  const connectionString = process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';

  // Test configuration - adjust these to reproduce the issue
  const THREADS_COUNT = 10;
  const MESSAGES_PER_THREAD = 2000; // Creates significant data within a single thread
  const TOTAL_MESSAGES = THREADS_COUNT * MESSAGES_PER_THREAD; // 20000 messages total
  const PERFORMANCE_THRESHOLD_MS = 500; // Expected max time for the query

  // Test identifiers
  const TEST_PREFIX = `perf-test-${Date.now()}`;
  const testResourceId = `${TEST_PREFIX}-resource`;
  const testThreadIds: string[] = [];

  beforeAll(async () => {
    store = new PostgresStore({
      id: 'row-number-perf-test',
      connectionString,
    });
    await store.init();

    console.log(`\n=== Setting up test data ===`);
    console.log(`Creating ${THREADS_COUNT} threads with ${MESSAGES_PER_THREAD} messages each...`);
    console.log(`Total messages: ${TOTAL_MESSAGES}`);

    // Create test threads
    for (let t = 0; t < THREADS_COUNT; t++) {
      const threadId = `${TEST_PREFIX}-thread-${t}`;
      testThreadIds.push(threadId);

      await store.saveThread({
        thread: {
          id: threadId,
          resourceId: testResourceId,
          title: `Performance Test Thread ${t}`,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // Batch insert messages for efficiency
    const db = store.db;
    const batchSize = 1000;

    for (let t = 0; t < THREADS_COUNT; t++) {
      const threadId = testThreadIds[t]!;
      console.log(`  Creating messages for thread ${t + 1}/${THREADS_COUNT}...`);

      const messages: Array<{
        id: string;
        thread_id: string;
        resourceId: string;
        content: string;
        role: string;
        type: string;
        createdAt: Date;
      }> = [];

      for (let m = 0; m < MESSAGES_PER_THREAD; m++) {
        // Stagger creation times to ensure proper ordering
        const createdAt = new Date(Date.now() - (MESSAGES_PER_THREAD - m) * 1000);
        messages.push({
          id: `${TEST_PREFIX}-msg-${t}-${m}`,
          thread_id: threadId,
          resourceId: testResourceId,
          content: JSON.stringify({ text: `Message ${m} in thread ${t}` }),
          role: m % 2 === 0 ? 'user' : 'assistant',
          type: 'v2',
          createdAt,
        });
      }

      // Batch insert
      for (let i = 0; i < messages.length; i += batchSize) {
        const batch = messages.slice(i, i + batchSize);
        const values = batch
          .map(
            (_, index) =>
              `($${index * 7 + 1}, $${index * 7 + 2}, $${index * 7 + 3}, $${index * 7 + 4}, $${index * 7 + 5}, $${index * 7 + 6}, $${index * 7 + 7})`,
          )
          .join(', ');

        const params = batch.flatMap(message => [
          message.id,
          message.thread_id,
          message.resourceId,
          message.content,
          message.role,
          message.type,
          message.createdAt,
        ]);

        await db.none(
          `INSERT INTO mastra_messages (id, thread_id, "resourceId", content, role, type, "createdAt") VALUES ${values}`,
          params,
        );
      }
    }

    // Update PostgreSQL statistics
    await db.none('ANALYZE mastra_messages');
    console.log(`Setup complete. Created ${TOTAL_MESSAGES} messages.`);
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    // Cleanup test data
    const db = store.db;
    console.log('\n=== Cleaning up test data ===');

    await db.none(`DELETE FROM mastra_messages WHERE id LIKE $1`, [`${TEST_PREFIX}%`]);
    await db.none(`DELETE FROM mastra_threads WHERE id LIKE $1`, [`${TEST_PREFIX}%`]);

    console.log('Cleanup complete.');
  }, 30000);

  it('should demonstrate the performance issue with ROW_NUMBER() on large threads', async () => {
    const threadId = testThreadIds[0]!;

    // Get some message IDs from the middle of the thread to use with include
    // This simulates what semantic recall does - finding similar messages
    const middleIndex = Math.floor(MESSAGES_PER_THREAD / 2);
    const includeMessageIds = [
      `${TEST_PREFIX}-msg-0-${middleIndex}`,
      `${TEST_PREFIX}-msg-0-${middleIndex + 10}`,
      `${TEST_PREFIX}-msg-0-${middleIndex + 20}`,
      `${TEST_PREFIX}-msg-0-${middleIndex + 30}`,
    ];

    console.log(`\n=== Testing listMessages with include (simulating semantic recall) ===`);
    console.log(`Thread has ${MESSAGES_PER_THREAD} messages`);
    console.log(
      `Including ${includeMessageIds.length} messages with context (withPreviousMessages=2, withNextMessages=2)`,
    );

    // Build the include parameter as semantic recall would
    const include = includeMessageIds.map(id => ({
      id,
      withPreviousMessages: 2,
      withNextMessages: 2,
    }));

    // Measure the query time
    const startTime = performance.now();

    const result = await store.listMessages({
      threadId,
      include,
      perPage: 40,
      page: 0,
    });

    const endTime = performance.now();
    const durationMs = endTime - startTime;

    console.log(`\nResults:`);
    console.log(`  Query duration: ${durationMs.toFixed(2)}ms`);
    console.log(`  Messages returned: ${result.messages.length}`);
    console.log(`  Performance threshold: ${PERFORMANCE_THRESHOLD_MS}ms`);
    console.log(`  Status: ${durationMs < PERFORMANCE_THRESHOLD_MS ? 'PASS' : 'FAIL - PERFORMANCE ISSUE DETECTED'}`);

    // The test should pass if the query is fast
    // If it fails, it demonstrates the performance issue
    expect(durationMs).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
    expect(result.messages.length).toBeGreaterThan(0);
  }, 30000);

  it('should show query plan for the ROW_NUMBER query', async () => {
    const targetMessageId = `${TEST_PREFIX}-msg-0-${Math.floor(MESSAGES_PER_THREAD / 2)}`;

    const db = store.db;

    // This is the exact query pattern used in _getIncludedMessages
    const explainQuery = `
      EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
      SELECT * FROM (
        WITH target_thread AS (
          SELECT thread_id FROM mastra_messages WHERE id = $1
        ),
        ordered_messages AS (
          SELECT
            *,
            ROW_NUMBER() OVER (ORDER BY "createdAt" ASC) as row_num
          FROM mastra_messages
          WHERE thread_id = (SELECT thread_id FROM target_thread)
        )
        SELECT
          m.id,
          m.content,
          m.role,
          m.type,
          m."createdAt",
          m."createdAtZ",
          m.thread_id AS "threadId",
          m."resourceId"
        FROM ordered_messages m
        WHERE m.id = $1
        OR EXISTS (
          SELECT 1 FROM ordered_messages target
          WHERE target.id = $1
          AND (
            (m.row_num < target.row_num AND m.row_num >= target.row_num - $2)
            OR
            (m.row_num > target.row_num AND m.row_num <= target.row_num + $3)
          )
        )
      ) AS query_1
    `;

    console.log(`\n=== Query Execution Plan ===`);
    console.log(`Target message: ${targetMessageId}`);
    console.log(`Thread has ${MESSAGES_PER_THREAD} messages\n`);

    const plan = await db.manyOrNone(explainQuery, [targetMessageId, 2, 2]);
    const planText = plan.map(row => row['QUERY PLAN']).join('\n');

    console.log(planText);

    // The plan should show that ROW_NUMBER() is applied to all rows in the thread
    // This is the root cause of the performance issue
    expect(planText).toContain('WindowAgg'); // Indicates window function usage
  }, 30000);

  it('should compare performance: with include vs without include', async () => {
    const threadId = testThreadIds[0]!;

    console.log(`\n=== Performance Comparison ===`);

    // Test 1: Simple listMessages without include (should be fast)
    const startWithout = performance.now();
    const resultWithout = await store.listMessages({
      threadId,
      perPage: 40,
      page: 0,
    });
    const durationWithout = performance.now() - startWithout;

    console.log(`Without include:`);
    console.log(`  Duration: ${durationWithout.toFixed(2)}ms`);
    console.log(`  Messages: ${resultWithout.messages.length}`);

    // Test 2: listMessages with include (demonstrates the issue)
    const middleIndex = Math.floor(MESSAGES_PER_THREAD / 2);
    const include = [
      { id: `${TEST_PREFIX}-msg-0-${middleIndex}`, withPreviousMessages: 2, withNextMessages: 2 },
      { id: `${TEST_PREFIX}-msg-0-${middleIndex + 10}`, withPreviousMessages: 2, withNextMessages: 2 },
    ];

    const startWith = performance.now();
    const resultWith = await store.listMessages({
      threadId,
      include,
      perPage: 40,
      page: 0,
    });
    const durationWith = performance.now() - startWith;

    console.log(`\nWith include (2 messages, context ±2):`);
    console.log(`  Duration: ${durationWith.toFixed(2)}ms`);
    console.log(`  Messages: ${resultWith.messages.length}`);

    const slowdownFactor = durationWith / durationWithout;
    console.log(`\nSlowdown factor: ${slowdownFactor.toFixed(2)}x`);

    // The include query should not be dramatically slower
    // If it is, the ROW_NUMBER() approach is causing issues
    expect(durationWith).toBeLessThan(PERFORMANCE_THRESHOLD_MS);
  }, 30000);

  it('should demonstrate scaling issue with more included messages', async () => {
    const threadId = testThreadIds[0]!;
    const middleIndex = Math.floor(MESSAGES_PER_THREAD / 2);

    console.log(`\n=== Scaling Test: More included messages = slower queries ===`);

    const testCases = [
      { count: 1, name: '1 included message' },
      { count: 2, name: '2 included messages' },
      { count: 4, name: '4 included messages (default topK)' },
      { count: 8, name: '8 included messages' },
    ];

    for (const testCase of testCases) {
      const include = Array.from({ length: testCase.count }, (_, i) => ({
        id: `${TEST_PREFIX}-msg-0-${middleIndex + i * 5}`,
        withPreviousMessages: 2,
        withNextMessages: 2,
      }));

      const start = performance.now();
      const result = await store.listMessages({
        threadId,
        include,
        perPage: 40,
        page: 0,
      });
      const duration = performance.now() - start;

      console.log(`${testCase.name}: ${duration.toFixed(2)}ms (${result.messages.length} messages returned)`);
    }

    // The issue: query time scales linearly (or worse) with number of included messages
    // because each one generates a separate CTE with ROW_NUMBER()
  }, 60000);
});
