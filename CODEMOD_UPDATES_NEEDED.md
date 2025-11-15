# Codemod Updates Needed for Domain-Based Storage API

## Summary

With the introduction of domain-based storage architecture, codemods that transform storage API calls need to be updated to:

1. Add domain store access (`await storage.getStore('domain')`)
2. Transform method calls from `storage.method()` to `domainStore.method()`

## Existing Codemods That Need Updates

### 1. `storage-get-messages-paginated.ts` ✅ NEEDS UPDATE

**Current behavior:**

- Transforms `storage.getMessagesPaginated()` → `storage.listMessages()`
- Updates `offset/limit` → `page/perPage`

**Needs to also:**

- Add `const memoryStore = await storage.getStore('memory')` before the call
- Transform `storage.listMessages()` → `memoryStore.listMessages()`

**Expected output:**

```typescript
// Before
const result = await storage.getMessagesPaginated({
  threadId: 'thread-123',
  offset: 0,
  limit: 20,
});

// After
const memoryStore = await storage.getStore('memory');
const result = await memoryStore.listMessages({
  threadId: 'thread-123',
  page: 0,
  perPage: 20,
});
```

### 2. `storage-list-workflow-runs.ts` ✅ NEEDS UPDATE

**Current behavior:**

- Transforms `storage.getWorkflowRuns()` → `storage.listWorkflowRuns()`

**Needs to also:**

- Add `const workflowsStore = await storage.getStore('workflows')` before the call
- Transform `storage.listWorkflowRuns()` → `workflowsStore.listWorkflowRuns()`

**Expected output:**

```typescript
// Before
const runs = await storage.getWorkflowRuns({ fromDate, toDate });

// After
const workflowsStore = await storage.getStore('workflows');
const runs = await workflowsStore.listWorkflowRuns({ fromDate, toDate });
```

### 3. `storage-list-messages-by-id.ts` ✅ NEEDS UPDATE

**Current behavior:**

- Transforms `storage.getMessagesById()` → `storage.listMessagesById()`

**Needs to also:**

- Add `const memoryStore = await storage.getStore('memory')` before the call
- Transform `storage.listMessagesById()` → `memoryStore.listMessagesById()`

**Expected output:**

```typescript
// Before
const result = await storage.getMessagesById({ messageIds: ['msg-1', 'msg-2'] });

// After
const memoryStore = await storage.getStore('memory');
const result = await memoryStore.listMessagesById({ messageIds: ['msg-1', 'msg-2'] });
```

### 4. `storage-get-threads-by-resource.ts` ✅ NEEDS UPDATE

**Current behavior:**

- Transforms `storage.getThreadsByResourceId()` → `storage.listThreadsByResourceId()`

**Needs to also:**

- Add `const memoryStore = await storage.getStore('memory')` before the call
- Transform `storage.listThreadsByResourceId()` → `memoryStore.listThreadsByResourceId()`

**Expected output:**

```typescript
// Before
const threads = await storage.getThreadsByResourceId({ resourceId: 'res-123' });

// After
const memoryStore = await storage.getStore('memory');
const threads = await memoryStore.listThreadsByResourceId({ resourceId: 'res-123' });
```

## New Codemods Needed

### 1. `storage-domain-api-migration.ts` 🆕 NEEDS CREATION

**Purpose:** Transform all direct storage method calls to use domain stores

**Should handle:**

- Memory domain methods: `listMessages`, `saveMessages`, `getMessages`, `getThreadById`, `listThreads`, `listThreadsByResourceId`, `listMessagesById`, `saveThread`, `getResourceById`, `saveResource`
- Workflows domain methods: `listWorkflowRuns`, `createWorkflowSnapshot`, `getWorkflowSnapshot`
- Evals domain methods: `listScoresByScorerId`, `listScoresByRunId`, `listScoresBySpan`, `saveScore`
- Observability domain methods: `getTrace`, `listTraces`, `createSpan`

**Pattern:**

```typescript
// Before
const messages = await storage.listMessages({ threadId: 'thread-1' });
const runs = await storage.listWorkflowRuns({ workflowId: 'workflow-1' });
const scores = await storage.getScores({ scorerId: 'scorer-1' });

// After
const memoryStore = await storage.getStore('memory');
const messages = await memoryStore.listMessages({ threadId: 'thread-1' });

const workflowsStore = await storage.getStore('workflows');
const runs = await workflowsStore.listWorkflowRuns({ workflowId: 'workflow-1' });

const evalsStore = await storage.getStore('evals');
const scores = await evalsStore.listScoresByScorerId({ scorerId: 'scorer-1' });
```

### 2. `storage-workflow-snapshot-methods.ts` 🆕 NEEDS CREATION

**Purpose:** Transform workflow snapshot method names and parameters

**Should handle:**

- `persistWorkflowSnapshot` → `createWorkflowSnapshot`
- `loadWorkflowSnapshot` → `getWorkflowSnapshot`
- `workflowName` parameter → `workflowId` parameter
- Add domain store access

**Expected output:**

```typescript
// Before
await storage.persistWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
  snapshot: { ... },
});

const snapshot = await storage.loadWorkflowSnapshot({
  workflowName: 'my-workflow',
  runId: 'run-123',
});

// After
const workflowsStore = await storage.getStore('workflows');
await workflowsStore.createWorkflowSnapshot({
  workflowId: 'my-workflow',
  runId: 'run-123',
  snapshot: { ... },
});

const snapshot = await workflowsStore.getWorkflowSnapshot({
  workflowId: 'my-workflow',
  runId: 'run-123',
});
```

### 3. `storage-evals-methods.ts` 🆕 NEEDS CREATION

**Purpose:** Transform evals method names and add domain store access

**Should handle:**

- `getScores` → `listScoresByScorerId`
- `scorerName` parameter → `scorerId` parameter
- Add domain store access

**Expected output:**

```typescript
// Before
const scores = await storage.getScores({ scorerName: 'helpfulness-scorer' });

// After
const evalsStore = await storage.getStore('evals');
const scores = await evalsStore.listScoresByScorerId({
  scorerId: 'helpfulness-scorer',
});
```

### 4. `storage-traces-migration.ts` 🆕 NEEDS CREATION

**Purpose:** Transform trace methods to use observability domain store

**Should handle:**

- `getTraces` → `getTrace` (single) or `listTraces` (multiple)
- `getTracesPaginated` → `listTraces`
- Add domain store access

**Expected output:**

```typescript
// Before
const trace = await storage.getTraces({ traceId: 'trace-123' });
const paginated = await storage.getTracesPaginated({ page: 0, perPage: 20 });

// After
const observabilityStore = await storage.getStore('observability');
const trace = await observabilityStore.getTrace('trace-123');
const paginated = await observabilityStore.listTraces({
  pagination: { page: 0, perPage: 20 },
});
```

## Implementation Notes

### Domain Method Mapping

Create a utility to map methods to their domains:

```typescript
const DOMAIN_METHOD_MAP = {
  memory: [
    'listMessages',
    'saveMessages',
    'getMessages',
    'getThreadById',
    'listThreads',
    'listThreadsByResourceId',
    'listMessagesById',
    'saveThread',
    'getResourceById',
    'saveResource',
  ],
  workflows: ['listWorkflowRuns', 'createWorkflowSnapshot', 'getWorkflowSnapshot'],
  evals: ['listScoresByScorerId', 'listScoresByRunId', 'listScoresBySpan', 'saveScore'],
  observability: ['getTrace', 'listTraces', 'createSpan'],
};
```

### Helper Function Needed

Create a utility function to:

1. Detect which domain a method belongs to
2. Insert `const domainStore = await storage.getStore('domain')` before the call
3. Transform `storage.method()` to `domainStore.method()`
4. Handle variable reuse (don't create duplicate `getStore()` calls for the same domain in the same scope)

## Testing

Each codemod should have:

- Input fixture showing old API usage
- Output fixture showing new domain-based API usage
- Tests verifying the transformation works correctly

## Priority

1. **HIGH**: Update existing codemods to add domain store access
2. **MEDIUM**: Create workflow snapshot methods codemod
3. **MEDIUM**: Create evals methods codemod
4. **LOW**: Create comprehensive domain API migration codemod (may overlap with updates above)
