import { randomUUID } from 'crypto';
import {
  createSampleEval,
  createSampleTraceForDB,
  createSampleThread,
  createTestSuite,
  createSampleMessageV1,
  resetRole,
} from '@internal/storage-test-utils';
import type { MastraMessageV1, StorageThreadType } from '@mastra/core';
import { Mastra } from '@mastra/core/mastra';
import { TABLE_EVALS, TABLE_TRACES, TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

import { LibSQLStore } from './index';

const TEST_DB_URL = 'file::memory:?cache=shared';

const libsql = new LibSQLStore({
  url: TEST_DB_URL,
});
const mastra = new Mastra({
  storage: libsql,
});

createTestSuite(mastra.getStorage()!);

describe('LibSQLStore Pagination Features', () => {
  let store: LibSQLStore;

  beforeAll(async () => {
    store = libsql;
  });

  beforeEach(async () => {
    await store.clearTable({ tableName: TABLE_EVALS });
    await store.clearTable({ tableName: TABLE_TRACES });
    await store.clearTable({ tableName: TABLE_MESSAGES });
    await store.clearTable({ tableName: TABLE_THREADS });
  });

  describe('getEvals with pagination', () => {
    it('should return paginated evals with total count (page/perPage)', async () => {
      const agentName = 'libsql-pagination-agent-evals';
      const evalRecords = Array.from({ length: 25 }, (_, i) => createSampleEval(agentName, i % 2 === 0));
      await store.batchInsert({ tableName: TABLE_EVALS, records: evalRecords.map(r => r as any) });

      const page1 = await store.getEvals({ agentName, page: 0, perPage: 10 });
      expect(page1.evals).toHaveLength(10);
      expect(page1.total).toBe(25);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(10);
      expect(page1.hasMore).toBe(true);

      const page3 = await store.getEvals({ agentName, page: 2, perPage: 10 });
      expect(page3.evals).toHaveLength(5);
      expect(page3.total).toBe(25);
      expect(page3.page).toBe(2);
      expect(page3.hasMore).toBe(false);
    });

    it('should support limit/offset pagination for getEvals', async () => {
      const agentName = 'libsql-pagination-lo-evals';
      const evalRecords = Array.from({ length: 15 }, () => createSampleEval(agentName));
      await store.batchInsert({ tableName: TABLE_EVALS, records: evalRecords.map(r => r as any) });

      const result = await store.getEvals({ agentName, page: 2, perPage: 5 });
      expect(result.evals).toHaveLength(5);
      expect(result.total).toBe(15);
      expect(result.page).toBe(2);
      expect(result.perPage).toBe(5);
      expect(result.hasMore).toBe(false);
    });

    it('should filter by type with pagination for getEvals', async () => {
      const agentName = 'libsql-pagination-type-evals';
      const testEvals = Array.from({ length: 10 }, () => createSampleEval(agentName, true));
      const liveEvals = Array.from({ length: 8 }, () => createSampleEval(agentName, false));
      await store.batchInsert({ tableName: TABLE_EVALS, records: [...testEvals, ...liveEvals].map(r => r as any) });

      const testResults = await store.getEvals({ agentName, type: 'test', page: 0, perPage: 5 });
      expect(testResults.evals).toHaveLength(5);
      expect(testResults.total).toBe(10);

      const liveResults = await store.getEvals({ agentName, type: 'live', page: 1, perPage: 3 });
      expect(liveResults.evals).toHaveLength(3);
      expect(liveResults.total).toBe(8);
      expect(liveResults.hasMore).toBe(true);
    });

    it('should filter by date with pagination for getEvals', async () => {
      const agentName = 'libsql-pagination-date-evals';
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const recordsToInsert = [
        createSampleEval(agentName, false, dayBeforeYesterday),
        createSampleEval(agentName, false, dayBeforeYesterday),
        createSampleEval(agentName, false, yesterday),
        createSampleEval(agentName, false, yesterday),
        createSampleEval(agentName, false, now),
        createSampleEval(agentName, false, now),
      ];
      await store.batchInsert({ tableName: TABLE_EVALS, records: recordsToInsert.map(r => r as any) });

      const fromYesterday = await store.getEvals({ agentName, dateRange: { start: yesterday }, page: 0, perPage: 3 });
      expect(fromYesterday.total).toBe(4);
      expect(fromYesterday.evals).toHaveLength(3); // Should get 2 from 'now', 1 from 'yesterday' due to DESC order and limit 3
      fromYesterday.evals.forEach(e =>
        expect(new Date(e.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime()),
      );
      // Check if the first item is from 'now' if possible (because of DESC order)
      if (fromYesterday.evals.length > 0) {
        expect(new Date(fromYesterday.evals[0].createdAt).toISOString().slice(0, 10)).toEqual(
          now.toISOString().slice(0, 10),
        );
      }

      const onlyDayBefore = await store.getEvals({
        agentName,
        dateRange: { end: new Date(yesterday.getTime() - 1) },
        page: 0,
        perPage: 5,
      });
      expect(onlyDayBefore.total).toBe(2);
      expect(onlyDayBefore.evals).toHaveLength(2);
    });
  });

  describe('getTraces with pagination', () => {
    it('should return paginated traces with total count when returnPaginationResults is true', async () => {
      const scope = 'libsql-test-scope-traces';
      const traceRecords = Array.from({ length: 18 }, (_, i) => createSampleTraceForDB(`test-trace-${i}`, scope));
      await store.batchInsert({ tableName: TABLE_TRACES, records: traceRecords.map(r => r as any) });

      const page1 = await store.getTracesPaginated({
        scope,
        page: 0,
        perPage: 8,
      });
      expect(page1.traces).toHaveLength(8);
      expect(page1.total).toBe(18);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(8);
      expect(page1.hasMore).toBe(true);

      const page3 = await store.getTracesPaginated({
        scope,
        page: 2,
        perPage: 8,
      });
      expect(page3.traces).toHaveLength(2);
      expect(page3.total).toBe(18);
      expect(page3.hasMore).toBe(false);
    });

    it('should return an array of traces when returnPaginationResults is undefined', async () => {
      const scope = 'libsql-array-traces';
      const traceRecords = [createSampleTraceForDB('trace-arr-1', scope), createSampleTraceForDB('trace-arr-2', scope)];
      await store.batchInsert({ tableName: TABLE_TRACES, records: traceRecords.map(r => r as any) });

      const tracesUndefined = await store.getTraces({
        scope,
        page: 0,
        perPage: 5,
      });
      expect(Array.isArray(tracesUndefined)).toBe(true);
      expect(tracesUndefined.length).toBe(2);
      // @ts-expect-error
      expect(tracesUndefined.total).toBeUndefined();
    });

    it('should filter by attributes with pagination for getTraces', async () => {
      const scope = 'libsql-attr-traces';
      const tracesWithAttr = Array.from({ length: 8 }, (_, i) =>
        createSampleTraceForDB(`trace-prod-${i}`, scope, { environment: 'prod' }),
      );
      const tracesWithoutAttr = Array.from({ length: 5 }, (_, i) =>
        createSampleTraceForDB(`trace-dev-${i}`, scope, { environment: 'dev' }),
      );
      await store.batchInsert({
        tableName: TABLE_TRACES,
        records: [...tracesWithAttr, ...tracesWithoutAttr].map(r => r as any),
      });

      const prodTraces = await store.getTracesPaginated({
        scope,
        attributes: { environment: 'prod' },
        page: 0,
        perPage: 5,
      });
      expect(prodTraces.traces).toHaveLength(5);
      expect(prodTraces.total).toBe(8);
      expect(prodTraces.hasMore).toBe(true);
    });

    it('should filter by date with pagination for getTraces', async () => {
      const scope = 'libsql-date-traces';
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const dayBeforeYesterday = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const recordsToInsert = [
        createSampleTraceForDB('t_dbf1', scope, undefined, dayBeforeYesterday),
        createSampleTraceForDB('t_dbf2', scope, undefined, dayBeforeYesterday),
        createSampleTraceForDB('t_y1', scope, undefined, yesterday),
        createSampleTraceForDB('t_y3', scope, undefined, yesterday),
        createSampleTraceForDB('t_n1', scope, undefined, now),
        createSampleTraceForDB('t_n2', scope, undefined, now),
      ];
      await store.batchInsert({ tableName: TABLE_TRACES, records: recordsToInsert.map(r => r as any) });

      const fromYesterday = await store.getTracesPaginated({
        scope,
        dateRange: { start: yesterday },
        page: 0,
        perPage: 3,
      });
      expect(fromYesterday.total).toBe(4);
      expect(fromYesterday.traces).toHaveLength(3);
      fromYesterday.traces.forEach(t =>
        expect(new Date(t.createdAt).getTime()).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime()),
      );
      if (fromYesterday.traces.length > 0 && fromYesterday.traces[0].createdAt === now.toISOString()) {
        expect(new Date(fromYesterday.traces[0].createdAt).toISOString().slice(0, 10)).toEqual(
          now.toISOString().slice(0, 10),
        );
      }

      const onlyNow = await store.getTracesPaginated({
        scope,
        dateRange: { start: now, end: now },
        page: 0,
        perPage: 5,
      });
      expect(onlyNow.total).toBe(2);
      expect(onlyNow.traces).toHaveLength(2);
      onlyNow.traces.forEach(t =>
        expect(new Date(t.createdAt).toISOString().slice(0, 10)).toEqual(now.toISOString().slice(0, 10)),
      );
    });
  });

  describe('getMessages with pagination', () => {
    it('should return paginated messages with total count', async () => {
      resetRole();
      const threadData = createSampleThread();
      threadData.resourceId = 'resource-msg-pagination';
      const thread = await store.saveThread({ thread: threadData as StorageThreadType });

      const messageRecords: MastraMessageV1[] = [];
      for (let i = 0; i < 15; i++) {
        messageRecords.push(createSampleMessageV1({ threadId: thread.id, content: `Message ${i + 1}` }));
      }
      await store.saveMessages({ messages: messageRecords });

      const page1 = await store.getMessagesPaginated({
        threadId: thread.id,
        selectBy: { pagination: { page: 0, perPage: 5 } },
        format: 'v1',
      });
      expect(page1.messages).toHaveLength(5);
      expect(page1.total).toBe(15);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(5);
      expect(page1.hasMore).toBe(true);

      const page3 = await store.getMessagesPaginated({
        threadId: thread.id,
        selectBy: { pagination: { page: 2, perPage: 5 } },
        format: 'v1',
      });
      expect(page3.messages).toHaveLength(5);
      expect(page3.total).toBe(15);
      expect(page3.hasMore).toBe(false);
    });

    it('should filter by date with pagination for getMessages', async () => {
      const threadData = createSampleThread();
      const thread = await store.saveThread({ thread: threadData as StorageThreadType });
      const now = new Date();
      const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      );
      const dayBeforeYesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 2,
        now.getHours(),
        now.getMinutes(),
        now.getSeconds(),
      );

      // Ensure timestamps are distinct for reliable sorting by creating them with a slight delay for testing clarity
      const messagesToSave: MastraMessageV1[] = [];
      messagesToSave.push(
        createSampleMessageV1({ threadId: thread.id, content: 'Message 1', createdAt: dayBeforeYesterday }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(
        createSampleMessageV1({ threadId: thread.id, content: 'Message 2', createdAt: dayBeforeYesterday }),
      );
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(createSampleMessageV1({ threadId: thread.id, content: 'Message 3', createdAt: yesterday }));
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(createSampleMessageV1({ threadId: thread.id, content: 'Message 4', createdAt: yesterday }));
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(createSampleMessageV1({ threadId: thread.id, content: 'Message 5', createdAt: now }));
      await new Promise(r => setTimeout(r, 5));
      messagesToSave.push(createSampleMessageV1({ threadId: thread.id, content: 'Message 6', createdAt: now }));

      await store.saveMessages({ messages: messagesToSave, format: 'v1' });
      // Total 6 messages: 2 now, 2 yesterday, 2 dayBeforeYesterday (oldest to newest)

      const fromYesterday = await store.getMessagesPaginated({
        threadId: thread.id,
        selectBy: { pagination: { page: 0, perPage: 3, dateRange: { start: yesterday } } },
        format: 'v2',
      });
      expect(fromYesterday.total).toBe(4);
      expect(fromYesterday.messages).toHaveLength(3);
      const firstMessageTime = new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).getTime();
      expect(firstMessageTime).toBeGreaterThanOrEqual(new Date(yesterday.toISOString()).getTime());
      if (fromYesterday.messages.length > 0) {
        expect(new Date((fromYesterday.messages[0] as MastraMessageV1).createdAt).toISOString().slice(0, 10)).toEqual(
          yesterday.toISOString().slice(0, 10),
        );
      }
    });
  });

  describe('getThreadsByResourceId with pagination', () => {
    it('should return paginated threads with total count', async () => {
      const resourceId = `libsql-paginated-resource-${randomUUID()}`;
      const threadRecords: StorageThreadType[] = [];
      for (let i = 0; i < 17; i++) {
        const threadData = createSampleThread();
        threadData.resourceId = resourceId;
        threadRecords.push(threadData as StorageThreadType);
      }
      for (const tr of threadRecords) {
        await store.saveThread({ thread: tr });
      }

      const page1 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 0, perPage: 7 });
      expect(page1.threads).toHaveLength(7);
      expect(page1.total).toBe(17);
      expect(page1.page).toBe(0);
      expect(page1.perPage).toBe(7);
      expect(page1.hasMore).toBe(true);

      const page3 = await store.getThreadsByResourceIdPaginated({ resourceId, page: 2, perPage: 7 });
      expect(page3.threads).toHaveLength(3);
      expect(page3.total).toBe(17);
      expect(page3.hasMore).toBe(false);
    });
  });
});
