---
'@mastra/elysia': minor
'@mastra/server': patch
---

Added an Elysia server adapter. Use the new @mastra/elysia package to run a Mastra server inside an Elysia app.

```typescript
import { Elysia } from 'elysia';
import { MastraServer } from '@mastra/elysia';
import { mastra } from './mastra';

const app = new Elysia();
const server = new MastraServer({ app, mastra });

await server.init();

app.listen(4111);
```
