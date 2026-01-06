---
'@mastra/core': patch
---

Messages without `createdAt` timestamps were getting shuffled because they all received identical timestamps during conversion. Now messages are assigned monotonically increasing timestamps via `generateCreatedAt()`, preserving input order.

Before:
```
Input:  [user: "hello", assistant: "Hi!", user: "bye"]
Output: [user: "bye", assistant: "Hi!", user: "hello"]  // shuffled!
```

After:
```
Input:  [user: "hello", assistant: "Hi!", user: "bye"]
Output: [user: "hello", assistant: "Hi!", user: "bye"]  // correct order
```

