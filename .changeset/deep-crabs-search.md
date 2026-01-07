---
'@mastra/fastify': minor
'@mastra/koa': minor
---

feat: Add Fastify and Koa server adapters

Introduces two new server adapters for Mastra:

- **@mastra/fastify**: Enables running Mastra applications on Fastify
- **@mastra/koa**: Enables running Mastra applications on Koa

Both adapters provide full MastraServerBase implementation including route registration, streaming responses, multipart uploads, auth middleware, and MCP transport support.

## Usage

### Fastify

```typescript
import Fastify from 'fastify';
import { MastraServer } from '@mastra/fastify';
import { mastra } from './mastra';

const app = Fastify();
const server = new MastraServer({ app, mastra });

await server.init();

app.listen({ port: 4111 });
```

### Koa

```typescript
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MastraServer } from '@mastra/koa';
import { mastra } from './mastra';

const app = new Koa();
app.use(bodyParser());

const server = new MastraServer({ app, mastra });

await server.init();

app.listen(4111);
```
