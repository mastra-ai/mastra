// @ts-nocheck
import { Memory } from '@mastra/core';

const memory = new Memory({
  storage,
  vector,
  embedder,
});

// Should transform - called on Memory instance
const result = await memory.query({ threadId: 'thread-123' });

// Multiple calls
const result2 = await memory.query({ threadId: 'thread-456', resourceId: 'res-1' });

// Should NOT transform - called on other object
const otherObj = {
  query: () => ({ messages: [] })
};
const other = otherObj.query();

// Should NOT transform - not a Memory instance
class MyClass {
  query() {
    return { messages: [] };
  }
}
const myInstance = new MyClass();
myInstance.query();