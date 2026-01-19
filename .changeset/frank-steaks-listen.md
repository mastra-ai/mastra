---
'@mastra/client-js': minor
---

Added processor resource to the JavaScript client SDK. You can now list processors, get processor details, and execute processors via the client:

```typescript
// List all processors
const processors = await client.listProcessors();

// Get processor details
const details = await client.getProcessor('my-processor').details();

// Execute a processor
const result = await client.getProcessor('my-processor').execute({
  phase: 'input',
  messages: [{ role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] } }],
});
```
