import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ListTablesCommand,
  waitUntilTableExists,
  waitUntilTableNotExists,
} from '@aws-sdk/client-dynamodb';
import type { MastraDBMessage } from '@mastra/core/memory';
import type { MemoryStorage } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';

import { MemoryStorageDynamoDB } from './index';

function createSampleThread() {
  const date = new Date();
  return {
    id: `thread-${randomUUID()}`,
    resourceId: `resource-${randomUUID()}`,
    title: 'Test Thread',
    createdAt: date,
    updatedAt: date,
    metadata: { key: 'value' },
  };
}

function createSampleMessageV2({
  threadId,
  resourceId,
  role = 'user',
  content,
  createdAt = new Date(),
}: {
  threadId: string;
  resourceId?: string;
  role?: 'user' | 'assistant';
  content?: { content?: string };
  createdAt?: Date;
}): MastraDBMessage {
  return {
    id: `msg-${randomUUID()}`,
    role,
    type: 'text',
    threadId,
    resourceId,
    createdAt,
    content: {
      format: 2,
      content: content?.content ?? 'Hello',
      parts: [{ type: 'text', text: content?.content ?? 'Hello' }],
    },
  };
}

function getMessageText(message: MastraDBMessage): string {
  if (typeof message.content === 'object' && message.content && 'content' in message.content) {
    return String(message.content.content ?? '');
  }
  return '';
}

const TEST_TABLE_NAME = 'mastra-list-messages-test';
const LOCAL_ENDPOINT = 'http://localhost:8000';
const LOCAL_REGION = 'local-test';
const DOCKER_COMPOSE_DIR = `${import.meta.dirname}/../..`;

let setupClient: DynamoDBClient;
let memory: MemoryStorage;

async function waitForDynamoDBLocal(client: DynamoDBClient, timeoutMs = 90000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    try {
      await client.send(new ListTablesCommand({}));
      return;
    } catch (e: unknown) {
      const errorName = e instanceof Error ? e.name : undefined;
      if (errorName === 'ECONNREFUSED' || errorName === 'TimeoutError' || errorName === 'ERR_INVALID_PROTOCOL') {
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        throw e;
      }
    }
  }
  throw new Error(`DynamoDB Local did not become ready within ${timeoutMs}ms.`);
}

async function createTestTable(client: DynamoDBClient): Promise<void> {
  try {
    await client.send(new DescribeTableCommand({ TableName: TEST_TABLE_NAME }));
    await client.send(new DeleteTableCommand({ TableName: TEST_TABLE_NAME }));
    await waitUntilTableNotExists({ client, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
  } catch (e: unknown) {
    if (!(e instanceof Error && e.name === 'ResourceNotFoundException')) {
      throw e;
    }
  }

  await client.send(
    new CreateTableCommand({
      TableName: TEST_TABLE_NAME,
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
        { AttributeName: 'gsi1pk', AttributeType: 'S' },
        { AttributeName: 'gsi1sk', AttributeType: 'S' },
        { AttributeName: 'gsi2pk', AttributeType: 'S' },
        { AttributeName: 'gsi2sk', AttributeType: 'S' },
        { AttributeName: 'gsi3pk', AttributeType: 'S' },
        { AttributeName: 'gsi3sk', AttributeType: 'S' },
        { AttributeName: 'gsi4pk', AttributeType: 'S' },
        { AttributeName: 'gsi4sk', AttributeType: 'S' },
        { AttributeName: 'gsi5pk', AttributeType: 'S' },
        { AttributeName: 'gsi5sk', AttributeType: 'S' },
        { AttributeName: 'gsi6pk', AttributeType: 'S' },
        { AttributeName: 'gsi6sk', AttributeType: 'S' },
        { AttributeName: 'gsi7pk', AttributeType: 'S' },
        { AttributeName: 'gsi7sk', AttributeType: 'S' },
      ],
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      GlobalSecondaryIndexes: Array.from({ length: 7 }, (_, i) => ({
        IndexName: `gsi${i + 1}`,
        KeySchema: [
          { AttributeName: `gsi${i + 1}pk`, KeyType: 'HASH' as const },
          { AttributeName: `gsi${i + 1}sk`, KeyType: 'RANGE' as const },
        ],
        Projection: { ProjectionType: 'ALL' as const },
      })),
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
  await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: TEST_TABLE_NAME });
}

async function saveLargeThread(
  storage: MemoryStorage,
  threadId: string,
  resourceId: string,
  count: number,
  payloadSize: number,
): Promise<MastraDBMessage[]> {
  const now = Date.now();
  const big = 'x'.repeat(payloadSize);
  const messages: MastraDBMessage[] = Array.from({ length: count }, (_, i) =>
    createSampleMessageV2({
      threadId,
      resourceId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      createdAt: new Date(now + i * 1000),
      content: { content: `msg-${i}-${big}` },
    }),
  );

  const batchSize = 25;
  for (let i = 0; i < messages.length; i += batchSize) {
    await storage.saveMessages({ messages: messages.slice(i, i + batchSize) });
  }

  return messages;
}

describe('DynamoDB listMessages pagination', () => {
  beforeAll(async () => {
    setupClient = new DynamoDBClient({
      endpoint: LOCAL_ENDPOINT,
      region: LOCAL_REGION,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      maxAttempts: 5,
    });

    const dynamodbProcess = spawn('docker', ['compose', 'up', '-d'], {
      cwd: DOCKER_COMPOSE_DIR,
      stdio: 'pipe',
    });
    dynamodbProcess.stderr?.on('data', data => console.error(`docker compose stderr: ${data}`));

    await new Promise(resolve => setTimeout(resolve, 3000));
    await waitForDynamoDBLocal(setupClient);
    await createTestTable(setupClient);

    const memoryStore = new MemoryStorageDynamoDB({
      tableName: TEST_TABLE_NAME,
      endpoint: LOCAL_ENDPOINT,
      region: LOCAL_REGION,
      credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
    });

    memory = memoryStore;
  }, 120000);

  it('returns all messages from a thread larger than one DynamoDB page', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });
    const saved = await saveLargeThread(memory, thread.id, thread.resourceId, 400, 4000);

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    expect(result.messages).toHaveLength(400);
    expect(result.total).toBe(400);
    expect(result.hasMore).toBe(false);
    expect(new Date(result.messages.at(-1)!.createdAt).getTime()).toBe(new Date(saved.at(-1)!.createdAt).getTime());
  }, 180000);

  it('returns the newest messages on DESC page 0', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const now = Date.now();
    const messages: MastraDBMessage[] = Array.from({ length: 30 }, (_, i) =>
      createSampleMessageV2({
        threadId: thread.id,
        createdAt: new Date(now + i * 1000),
        content: { content: `Message ${i}` },
      }),
    );
    await memory.saveMessages({ messages });

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 20,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    expect(result.messages).toHaveLength(20);
    expect(result.total).toBe(30);
    expect(result.hasMore).toBe(true);
    expect(getMessageText(result.messages[0]!)).toBe('Message 29');
    expect(getMessageText(result.messages.at(-1)!)).toBe('Message 10');
  });

  it('returns include context for a target beyond the first DynamoDB page', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });
    const saved = await saveLargeThread(memory, thread.id, thread.resourceId, 400, 4000);
    const target = saved[395]!;

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 0,
      include: [{ id: target.id, withPreviousMessages: 2, withNextMessages: 2 }],
    });

    expect(result.messages).toHaveLength(5);
    const indices = result.messages.map(m => Number(getMessageText(m).match(/^msg-(\d+)-/)?.[1]));
    expect(indices).toEqual([393, 394, 395, 396, 397]);
  }, 180000);

  it('filters by date range with correct total and page contents', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const base = Date.now();
    const messages: MastraDBMessage[] = [
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base), content: { content: 'm0' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 1000), content: { content: 'm1' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 2000), content: { content: 'm2' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 3000), content: { content: 'm3' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 4000), content: { content: 'm4' } }),
    ];
    await memory.saveMessages({ messages });

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 2,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: {
        dateRange: {
          start: new Date(base + 1000),
          end: new Date(base + 3000),
        },
      },
    });

    expect(result.total).toBe(3);
    expect(result.messages).toHaveLength(2);
    expect(result.messages.map(getMessageText)).toEqual(['m1', 'm2']);
    expect(result.hasMore).toBe(true);
  });

  it('keeps hasMore true when include context is present but filtered pages remain', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const base = Date.now();
    const messages: MastraDBMessage[] = Array.from({ length: 30 }, (_, i) =>
      createSampleMessageV2({
        threadId: thread.id,
        createdAt: new Date(base + i * 1000),
        content: { content: `msg-${i}` },
      }),
    );
    await memory.saveMessages({ messages });
    const target = messages[20]!;

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 5,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      include: [{ id: target.id, withPreviousMessages: 10, withNextMessages: 10 }],
    });

    expect(result.total).toBe(30);
    expect(result.messages.length).toBeGreaterThan(5);
    expect(result.hasMore).toBe(true);
  });

  it('does not suppress hasMore when include adds messages outside the date range filter', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const base = Date.now();
    const messages: MastraDBMessage[] = Array.from({ length: 10 }, (_, i) =>
      createSampleMessageV2({
        threadId: thread.id,
        createdAt: new Date(base + i * 1000),
        content: { content: `msg-${i}` },
      }),
    );
    await memory.saveMessages({ messages });

    // Filter matches msg-4..msg-9 (total 6). Page 0 returns msg-4, msg-5, msg-6.
    // Include targets msg-0 with context msg-0..msg-2 — all outside the date range.
    // The 3 filtered + 3 included = 6 returned messages must NOT satisfy total=6:
    // msg-7..msg-9 still match the filter and remain unfetched.
    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 3,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: { dateRange: { start: new Date(base + 4000) } },
      include: [{ id: messages[0]!.id, withNextMessages: 2 }],
    });

    expect(result.total).toBe(6);
    expect(result.messages.map(getMessageText)).toEqual(['msg-0', 'msg-1', 'msg-2', 'msg-4', 'msg-5', 'msg-6']);
    expect(result.hasMore).toBe(true);
  });

  it('reports hasMore false when pagination plus include return all filtered messages', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const base = Date.now();
    const messages: MastraDBMessage[] = Array.from({ length: 5 }, (_, i) =>
      createSampleMessageV2({
        threadId: thread.id,
        createdAt: new Date(base + i * 1000),
        content: { content: `msg-${i}` },
      }),
    );
    await memory.saveMessages({ messages });

    // Page 0 returns msg-0..msg-2; include pulls msg-3 and msg-4 → all 5 returned.
    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 3,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      include: [{ id: messages[3]!.id, withNextMessages: 1 }],
    });

    expect(result.total).toBe(5);
    expect(result.messages).toHaveLength(5);
    expect(result.hasMore).toBe(false);
  });

  it('supports exclusive date range boundaries via between() plus where()', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });

    const base = Date.now();
    const messages: MastraDBMessage[] = [
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base), content: { content: 'm0' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 1000), content: { content: 'm1' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 2000), content: { content: 'm2' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 3000), content: { content: 'm3' } }),
      createSampleMessageV2({ threadId: thread.id, createdAt: new Date(base + 4000), content: { content: 'm4' } }),
    ];
    await memory.saveMessages({ messages });

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 10,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
      filter: {
        dateRange: {
          start: new Date(base + 1000),
          end: new Date(base + 3000),
          startExclusive: true,
          endExclusive: true,
        },
      },
    });

    expect(result.total).toBe(1);
    expect(result.messages.map(getMessageText)).toEqual(['m2']);
    expect(result.hasMore).toBe(false);
  });

  it('does not drop messages when threadId is an array (multi-thread)', async () => {
    const threadA = createSampleThread();
    const threadB = createSampleThread();
    await memory.saveThread({ thread: threadA });
    await memory.saveThread({ thread: threadB });

    await memory.saveMessages({
      messages: [
        createSampleMessageV2({ threadId: threadA.id, createdAt: new Date(Date.now()), content: { content: 'a1' } }),
        createSampleMessageV2({
          threadId: threadB.id,
          createdAt: new Date(Date.now() + 1000),
          content: { content: 'b1' },
        }),
      ],
    });

    const result = await memory.listMessages({
      threadId: [threadA.id, threadB.id],
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    expect(result.total).toBe(2);
    expect(result.messages.map(getMessageText).sort()).toEqual(['a1', 'b1']);
  });

  it('returns full requested page when offset+perPage crosses a DynamoDB page boundary', async () => {
    const thread = createSampleThread();
    await memory.saveThread({ thread });
    await saveLargeThread(memory, thread.id, thread.resourceId, 400, 4000);

    const result = await memory.listMessages({
      threadId: thread.id,
      perPage: 300,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    expect(result.messages).toHaveLength(300);
    expect(result.total).toBe(400);
    expect(result.hasMore).toBe(true);
  }, 180000);
});
