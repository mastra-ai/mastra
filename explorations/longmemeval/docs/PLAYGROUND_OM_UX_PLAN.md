# Playground Observational Memory UX Plan

## Problem Statement

When using Observational Memory (OM) in the Playground:
1. The UI doesn't know how to query the context window on refresh
2. OM doesn't use MessageHistory in the traditional way - it stores observations, not raw messages
3. The current `useAgentMessages` hook uses `client.listThreadMessages(threadId, ...)` which queries traditional message history
4. OM stores observations in `ObservationalMemoryRecord`, not in the messages table

## Design Decisions (Confirmed)

### Display Preference
- **Both inline AND sidebar**
- Inline: Collapsed by default, shows memory icons + stats, expandable to scrollable section with observations
- Sidebar: Shows OM config and observations

### Raw Messages
- **Yes, show both**
- On load: Observations at top, active message history below
- Backwards pagination: Nice-to-have, not critical

### Priority
- **High priority** - validate feature before continuing storage adapter implementations
- Reason: Need to ensure API is correct before building more adapters

## Current Architecture

### Frontend (playground-ui)
- `useMemory` hook → `client.getMemoryStatus(agentId)` → `{ result: boolean }`
- `useMemoryConfig` hook → `client.getMemoryConfig({ agentId })` → `{ config: {...} }`
- `useAgentMessages` hook → `client.listThreadMessages(threadId, ...)` → messages
- No awareness of OM vs traditional memory

### Backend (server)
- `GET /api/memory/status` → `{ result: boolean }` - just says if memory exists
- `GET /api/memory/config` → `{ config: { lastMessages, semanticRecall, workingMemory } }`
- `GET /api/memory/threads/:threadId/messages` → lists messages from storage
- No OM-specific data in responses

### OM Storage
- `ObservationalMemoryRecord` contains:
  - `activeObservations` - the compressed context window
  - `patterns` - recognized patterns
  - `generationCount` - reflection count
  - `lastObservedAt`, `lastReflectionAt` - timestamps
- Stored per-resource (not per-thread) when `scope: 'resource'`

## Proposed Solution

### Phase 1: Extend Existing Endpoints

1. **Extend `GET /api/memory/config` response**
   ```ts
   {
     config: {
       lastMessages: number | false,
       semanticRecall: boolean | object,
       workingMemory: object,
       // NEW: OM config
       observationalMemory?: {
         enabled: boolean,
         scope: 'thread' | 'resource',
         observationThreshold: number,
         reflectionThreshold: number,
         maxObservationTokens: number,
         // etc.
       }
     }
   }
   ```

2. **Extend `GET /api/memory/status` to include OM status**
   - Add query params: `resourceId`, `threadId?`
   ```ts
   {
     result: boolean,
     // NEW: OM status (when OM is enabled)
     observationalMemory?: {
       hasRecord: boolean,
       generationCount: number,
       lastObservedAt: Date | null,
       lastReflectionAt: Date | null,
       activeObservationsTokenCount: number,
       patternsCount: number
     }
   }
   ```

3. **Add `GET /api/memory/observational-memory` endpoint for full OM data**
   - Query: `{ resourceId, threadId?, agentId }`
   ```ts
   {
     record: {
       id: string,
       activeObservations: string,
       patterns: string[],
       generationCount: number,
       lastObservedAt: Date | null,
       lastReflectionAt: Date | null,
       scope: 'thread' | 'resource'
     } | null
   }
   ```

### Phase 2: Frontend Hooks & Client

1. **Extend `useMemoryConfig`** - already returns config, just need backend to include OM config

2. **Extend `useMemory`** - add resourceId param, backend returns OM status

3. **New `useObservationalMemory` hook** - fetches full OM record when needed
   ```ts
   const { data: omData } = useObservationalMemory({
     agentId,
     resourceId,
     threadId,
     enabled: config?.observationalMemory?.enabled
   });
   ```

4. **React client SDK** - add `getObservationalMemory()` method

### Phase 3: UI Components

1. **Inline OM Block (in chat area)**
   - Collapsed: Memory icon + "X observations, Y reflections, Z tokens"
   - Expanded: Scrollable section showing full observations text
   - Appears at top of chat, before messages

2. **Sidebar OM Panel (in AgentMemory component)**
   - OM Config section: Shows thresholds, scope, etc.
   - OM Status section: Shows generation count, timestamps
   - Observations section: Collapsible, shows full observations

3. **Message History Below**
   - Normal message list continues below OM block
   - Messages that have been "observed" could have a subtle indicator

## Implementation Order

1. **Backend: Extend config endpoint** - add OM config to response
2. **Backend: Extend status endpoint** - add OM status, accept resourceId
3. **Backend: Add OM data endpoint** - return full OM record
4. **Client SDK: Add methods** - getObservationalMemory()
5. **Frontend hooks: Extend/add** - useMemory, useObservationalMemory
6. **UI: Inline OM block** - collapsible observations in chat
7. **UI: Sidebar OM panel** - config and observations display

## Files to Modify

### Backend
- `packages/server/src/server/handlers/memory.ts` - extend handlers, add OM endpoint
- `packages/server/src/server/schemas/memory.ts` - extend schemas
- `packages/server/src/server/server-adapter/routes/memory.ts` - add OM route

### Client SDK
- `packages/client-js/src/resources/memory.ts` - add getObservationalMemory()
- `packages/react/src/client.ts` - expose new method

### Frontend
- `packages/playground-ui/src/domains/memory/hooks/use-memory.ts` - extend hooks
- `packages/playground-ui/src/domains/agents/components/agent-chat.tsx` - add OM block
- `packages/playground-ui/src/domains/agents/components/agent-information/agent-memory.tsx` - add OM panel
- New: `packages/playground-ui/src/domains/memory/components/om-observation-block.tsx`

## Notes

- OM is experimental, UI should indicate this clearly
- Need to handle case where OM is enabled but no record exists yet (first message)
- Consider token counting display to help users understand compression
