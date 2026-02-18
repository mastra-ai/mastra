# PR #13081 Review: feat(e2e): add client-js e2e tests for agents, memory, workflows, tools, and vectors

**Overall**: Good contribution — the factory pattern matches the existing observability tests well, test coverage is meaningful, and the server-setup extensions are thoughtfully done (separate file-based vector DB, memory integration, cleanup). There are some issues worth addressing before merge though.

---

## 1. Vector test type mismatches — `any` casts hide real SDK type bugs

The vector tests cast results to `any` throughout, with comments like "Server returns string[] directly". I verified these against the actual server handlers (`packages/server/src/server/handlers/vector.ts`) and the client SDK (`client-sdks/client-js/src/resources/vector.ts`):

**`getIndexes()`** — `vector-tests.ts:78-81`
- Server handler returns `string[]` (line 321 of vector.ts: `return indexes.filter(Boolean)`)
- Client SDK type says `Promise<{ indexes: string[] }>`
- Test asserts `string[]` (matching the server, not the SDK type)

**`upsert()`** — `vector-tests.ts:97-109`
- Server handler returns `{ ids: result }` (line 236 of vector.ts)
- Client SDK type says `Promise<string[]>`
- Test asserts `{ ids: string[] }` (matching the server, not the SDK type)

These `any` casts are masking a real discrepancy between the SDK types and the server responses. The e2e tests should be surfacing this kind of problem, not working around it. Suggestion: either file an issue about the SDK type mismatches and reference it in comments, or remove the `any` casts and let the type errors serve as documentation of the problem.

---

## 2. Vector tests are order-dependent

`vector-tests.ts:57`:
```typescript
const indexName = `test_index_${Date.now()}`;
```

This is evaluated once at module load time and shared across all `describe` blocks. The "upsert and query" block depends on "createIndex" having already created the index, and "deleteIndex" depends on it still existing. Vitest runs `describe` blocks sequentially by default so this works, but it's fragile and makes individual test isolation impossible.

Consider either:
- Wrapping everything in a single `describe` with explicit ordering via sequential `it` blocks
- Or creating/tearing down the index in `beforeAll`/`afterAll` for each describe that needs it

---

## 3. Memory `beforeEach` resets ALL storage — interference risk

`memory-tests.ts:129-136`:
```typescript
beforeEach(async () => {
  try {
    await fetch(`${baseUrl}/e2e/reset-storage`, { method: 'POST' });
  } catch {
    // ignore
  }
});
```

The `/e2e/reset-storage` endpoint clears **both** observability and memory stores. Since memory tests run in the same server as observability tests (within a zod variant), calling this in `beforeEach` (every test case) will wipe observability data mid-suite if tests run in a certain order.

The existing observability tests only reset in `beforeAll` (once per suite). Suggestion: switch to `beforeAll` here too, or add a separate memory-only reset endpoint.

---

## 4. Tool validation error test makes fragile assumptions

`tool-tests.ts:76-82`:
```typescript
const result: any = await tool.execute({ data: { a: 'not-a-number', b: 3 } });
expect(result).toBeDefined();
expect(result.error).toBeDefined();
```

This assumes the server returns `{ error: ... }` for Zod validation failures rather than throwing an HTTP error. The `any` cast hides whether this actually works. If the server throws a 400, `execute()` will reject the promise and this test will fail with an unhandled rejection rather than a clean assertion failure.

---

## 5. Missing `count` field in vector `details()` assertion

`vector-tests.ts:85-89`:
```typescript
const details = await vector.details(indexName);
expect(details.dimension).toBe(3);
expect(details.metric).toBe('cosine');
```

The server's `describeIndex` handler also returns a `count` field. Since this test runs after index creation but before any upserts, asserting `expect(details.count).toBe(0)` would strengthen the test.

---

## 6. Merge conflicts

The PR has merge conflicts that need to be resolved before merging.

---

## Minor nits

- `memory-tests.ts:161` — `expect(thread.metadata?.key).toBe('value')` could use `toEqual` for the full metadata object to catch unexpected extra fields
- Workflow `runs()` test (`workflow-tests.ts:93`) — consider verifying the returned run has the expected `status` and `result`, not just that the array is non-empty
- The `listMemoryThreads` test creates one thread and checks `length > 0` — since `beforeEach` resets storage, `toBe(1)` would be more precise

---

## What looks good

- Factory pattern with configurable `testNameSuffix` matches existing conventions nicely
- File-based temp DB for vectors with UUID naming and cleanup (including WAL/SHM files) is thoughtful
- Tool and workflow definitions are simple and don't require LLM calls — good for deterministic testing
- Zod v3/v4 test files are minimal wrappers, as expected
- `ProvidedContext` deduplication into `server-setup.ts` is the right call
