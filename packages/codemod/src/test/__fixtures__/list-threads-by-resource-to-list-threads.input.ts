// @ts-nocheck
import { Memory } from '@mastra/memory';

const memory = new Memory({ storage });

// Basic transformation
const result1 = await memory.listThreads({
  filter: { resourceId: 'user-123' },
  page: 0,
  perPage: 10,
});

// With all options
const result2 = await memory.listThreads({
  filter: { resourceId: 'user-456' },
  page: 1,
  perPage: 20,
  orderBy: { field: 'updatedAt', direction: 'DESC' },
});

// With perPage false
const result3 = await memory.listThreads({
  filter: { resourceId },
  perPage: false,
});

// On storage adapter
const result4 = await memoryStore.listThreads({
  filter: { resourceId: 'test-resource' },
  page: 0,
  perPage: 5,
});
