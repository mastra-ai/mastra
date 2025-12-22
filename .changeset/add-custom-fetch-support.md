---
'@mastra/client-js': minor
---

Add support for custom fetch function in MastraClient to enable environments like Tauri that require custom fetch implementations to avoid timeout errors.

You can now pass a custom fetch function when creating a MastraClient:

```typescript
import { MastraClient } from '@mastra/client-js';

// Before: Only global fetch was available
const client = new MastraClient({
  baseUrl: 'http://your-api-url',
});

// After: Custom fetch can be passed
const client = new MastraClient({
  baseUrl: 'http://your-api-url',
  fetch: customFetch, // Your custom fetch implementation
});
```

If no custom fetch is provided, it falls back to the global fetch function, maintaining backward compatibility.

Fixes #10673
