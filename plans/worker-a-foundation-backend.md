# Worker A: Foundation + Backend Core

> **Role**: Schema changes + Memory API  
> **Priority**: HIGH - Foundation tasks block other workers  
> **Estimated Time**: 4-6 hours

---

## Overview

Worker A is responsible for the foundational schema changes that all other workers depend on, plus the Memory Configs API endpoint.

---

## Tasks

### Task 1: Add `source` Field to Agent Schema & Response

**Priority**: CRITICAL - Blocks Workers B, D, E

**Goal**: Distinguish stored agents from code-defined agents in API responses.

**Files to modify**:

| File                                            | Changes                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `packages/core/src/agent/types.ts`              | Add `source?: 'code' \| 'stored'` to `AgentConfig`          |
| `packages/core/src/mastra/index.ts`             | Set `source: 'stored'` in `#createAgentFromStoredConfig()`  |
| `packages/server/src/server/schemas/agents.ts`  | Add `source` to `serializedAgentSchema`                     |
| `packages/server/src/server/handlers/agents.ts` | Include `source` in `formatAgent()` and `formatAgentList()` |
| `client-sdks/client-js/src/types.ts`            | Add `source?: 'code' \| 'stored'` to `GetAgentResponse`     |

**Implementation Details**:

1. In `packages/core/src/agent/types.ts`, find `AgentConfig` or similar interface and add:

   ```typescript
   source?: 'code' | 'stored';
   ```

2. In `packages/core/src/mastra/index.ts`, find `#createAgentFromStoredConfig()` (~line 922) and add `source: 'stored'` to the agent config.

3. In `packages/server/src/server/schemas/agents.ts`, add to `serializedAgentSchema`:

   ```typescript
   source: z.enum(['code', 'stored']).optional(),
   ```

4. In `packages/server/src/server/handlers/agents.ts`:
   - In `formatAgent()` function, add `source: agent.source ?? 'code'`
   - In `formatAgentList()` function, same change

5. In `client-sdks/client-js/src/types.ts`, find `GetAgentResponse` or agent response type and add:
   ```typescript
   source?: 'code' | 'stored';
   ```

**Verification**:

- Build passes: `pnpm build:core && pnpm build`
- Type check passes: `pnpm typecheck`

---

### Task 7: Add Memory Configs API Endpoint & Hook

**Priority**: MEDIUM - Enables memory picker in UI

**Goal**: Expose registered memory configurations for the agent form picker.

**Files to modify/create**:

| File                                                         | Changes                          |
| ------------------------------------------------------------ | -------------------------------- |
| `packages/server/src/server/handlers/memory.ts`              | Add `LIST_MEMORY_CONFIGS_ROUTE`  |
| `packages/server/src/server/server-adapter/routes/memory.ts` | Register the new route           |
| `client-sdks/client-js/src/client.ts`                        | Add `listMemoryConfigs()` method |
| `client-sdks/client-js/src/types.ts`                         | Add `MemoryConfig` type          |

**Implementation Details**:

1. In `packages/server/src/server/handlers/memory.ts`, add:

   ```typescript
   export const LIST_MEMORY_CONFIGS_ROUTE = createRoute({
     method: 'GET',
     path: '/api/memory/configs',
     responseType: 'json',
     summary: 'List registered memory configurations',
     description: 'Returns a list of all memory configurations registered with the Mastra instance',
     tags: ['Memory'],
     handler: async ({ mastra }) => {
       try {
         const memoryRegistry = mastra.listMemory();
         const configs = Object.entries(memoryRegistry || {}).map(([key, memory]) => ({
           id: key,
           name: memory.id || key,
         }));
         return { configs };
       } catch (error) {
         return handleError(error, 'Error listing memory configs');
       }
     },
   });
   ```

2. Register the route in `packages/server/src/server/server-adapter/routes/memory.ts`

3. In `client-sdks/client-js/src/types.ts`, add:

   ```typescript
   export interface MemoryConfig {
     id: string;
     name?: string;
   }

   export interface ListMemoryConfigsResponse {
     configs: MemoryConfig[];
   }
   ```

4. In `client-sdks/client-js/src/client.ts`, add method:
   ```typescript
   public async listMemoryConfigs(
     requestContext?: Record<string, unknown>
   ): Promise<ListMemoryConfigsResponse> {
     return this.request('/api/memory/configs', {
       method: 'GET',
       headers: this.buildHeaders(requestContext),
     });
   }
   ```

**Verification**:

- Build passes
- Test endpoint manually or with curl: `curl http://localhost:4111/api/memory/configs`

---

## File Ownership

These files are owned by Worker A - no other worker should modify them:

- `packages/core/src/agent/types.ts`
- `packages/server/src/server/handlers/memory.ts` (new route only)
- `packages/server/src/server/handlers/agents.ts` (formatAgent changes)

**Shared files** (coordinate with Worker C):

- `client-sdks/client-js/src/types.ts` - Worker A adds `source`, Worker C adds version types

---

## Handoff

After completing Task 1:

- Notify Workers B, D, E that `source` field is available
- They can now use `agent.source === 'stored'` in UI logic

After completing Task 7:

- Notify Worker B that `listMemoryConfigs()` is available
- Worker B can now build the memory picker in the agent form

---

## Testing Checklist

- [ ] `pnpm build` passes
- [ ] `pnpm typecheck` passes
- [ ] `source` field appears in `/api/agents` response
- [ ] `source: 'stored'` appears for stored agents
- [ ] `source: 'code'` (or undefined) for code-defined agents
- [ ] `/api/memory/configs` returns list of registered memory configs
- [ ] Client SDK `listMemoryConfigs()` works
