// @ts-nocheck
import { Memory } from '@mastra/memory';
import { Memory as AliasedMemory } from '@mastra/memory';

const storage: any = undefined;
const memoryStore: any = undefined;
const resourceId: string = 'dynamic-id';

const memory = new Memory({ storage });

// Basic transformation
const result1 = await memory.listThreadsByResourceId({
  resourceId: 'user-123',
  page: 0,
  perPage: 10,
});

// With all options
const result2 = await memory.listThreadsByResourceId({
  resourceId: 'user-456',
  page: 1,
  perPage: 20,
  orderBy: { field: 'updatedAt', direction: 'DESC' },
});

// With perPage false
const result3 = await memory.listThreadsByResourceId({
  resourceId: resourceId,
  perPage: false,
});

// On storage adapter
const result4 = await memoryStore.listThreadsByResourceId({
  resourceId: 'test-resource',
  page: 0,
  perPage: 5,
});

// NEGATIVE: should NOT transform (non-Memory object)
const other = {
  listThreadsByResourceId(args: any) {
    return args;
  },
};
const result5 = await other.listThreadsByResourceId({ resourceId: 'do-not-touch' });

// Aliased import: should transform
const aliasedMemory = new AliasedMemory({ storage });
const result6 = await aliasedMemory.listThreadsByResourceId({
  resourceId: 'aliased-user-123',
  page: 0,
  perPage: 15,
});
