// @ts-nocheck
import { Memory } from '@mastra/core';

const memory = new Memory({
  storage,
  vector,
  embedder,
});

// Should transform - vectorMessageSearch parameter
memory.recall({
  threadId: 'thread-123',
  vectorMessageSearch: 'What did we discuss?',
  page: 0,
  perPage: 20,
});

// Multiple occurrences
const result = await memory.recall({
  threadId: 'thread-456',
  vectorMessageSearch: 'search query',
});

// Should NOT transform - different method
const other = {
  recall: (params: any) => params
};
other.recall({ vectorMessageSearch: 'should-not-change' });