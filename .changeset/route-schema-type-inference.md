---
'@mastra/server': minor
---

Added `@mastra/server/schemas` export with utility types that infer path params, query params, request body, and response types from any route in `SERVER_ROUTES`. When you add a new route via `createRoute()`, it automatically appears in the `RouteMap` type — no manual contract needed.

```ts
import type { RouteMap, RouteContract, InferPathParams, InferBody, InferResponse } from '@mastra/server/schemas';

type GetAgentParams = InferPathParams<RouteMap['GET /agents/:agentId']>;
// => { agentId: string }

type GenerateBody = InferBody<RouteMap['POST /agents/:agentId/generate']>;
// => { messages: CoreMessage[], ... }

type AgentResponse = InferResponse<RouteMap['GET /agents/:agentId']>;
// => { name: string, tools: ..., ... }
```
