---
'@mastra/server': minor
'mastra': patch
---

Stored workflows can now be managed over HTTP: create or update a declarative workflow definition with `POST /stored/workflows`, list/fetch with `GET`, and remove with `DELETE` — with malformed graphs rejected at the API boundary with actionable errors instead of failing deep inside rehydration.

```ts
await fetch(`${baseUrl}/stored/workflows`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    id: 'greeting-workflow',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    outputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    graph: [{ type: 'agent', id: 'greet', agentId: 'greeter-agent' }],
  }),
});
```

**`DELETE /stored/workflows/:storedWorkflowId` now unregisters the live workflow instance** in addition to removing the stored row. Previously the handler only called `store.delete(id)`, leaving the rehydrated `Workflow` on `Mastra` until the process restarted. The handler now calls `mastra.removeWorkflow(id)` after `store.delete`. Idempotent on missing ids.

**`POST /stored/workflows` body schema is now a typed discriminated union.** The `graph` field was previously typed as `z.array(z.any())` and would only surface malformed entries deep inside `rehydrateWorkflow`. It is now a discriminated union over `type: 'step' | 'agent' | 'tool' | 'mapping' | 'parallel' | 'foreach' | 'sleep' | 'sleepUntil'`, matching the serialized graph shape `toStorableGraph` emits. Combined with the new `Mastra.addStoredWorkflow` pre-flight, invalid ids, mis-classified refs, and JSON Schemas that use converter-unsupported keywords (`oneOf` / `anyOf` / …) are rejected at the HTTP boundary with actionable errors before rehydration runs. `inputSchema` / `outputSchema` / `stateSchema` / `requestContextSchema` remain `z.any()` — they're JSON Schema Draft 2020-12 blobs, validated in `addStoredWorkflow` before the row is persisted.

**`foreach.opts` is now optional on both sides of the wire.** Previously the Zod schema declared `opts` optional but the underlying `SerializedForeachEntry.opts` was required, forcing a `Parameters<Mastra['addStoredWorkflow']>[0]` cast in the handler that defeated compile-time drift detection. `SerializedForeachEntry.opts` is now optional in core, the Zod schema and the runtime type agree, and the handler cast is gone. Runtime unchanged (engine already read `entry.opts?.concurrency ?? 1`).

**`conditional` and `loop` entries now round-trip through `POST /stored/workflows`.** The body schema's discriminated union has been extended with `type: 'conditional'` (`steps: SingleStepEntry[]`, `predicates: Predicate[]`) and `type: 'loop'` (`step: SingleStepEntry`, `loopType: 'dowhile' | 'dountil'`, `predicate: Predicate`), where `Predicate` is the same structural JSON shape now exported from `@mastra/core/workflows`. Legacy closure-based `serializedConditions` payloads are rejected at the HTTP boundary rather than silently reaching the rehydrator.

**Nested workflow references now round-trip through `POST /stored/workflows`.** The body schema's `SingleStepEntry` union gains a `type: 'workflow'` variant (`id`, `workflowId`, optional `description`) that can appear at the top level or inside any composite entry. `serializedStepFlowEntrySchema` (returned by `GET /workflows/:id`) mirrors the same variant so clients see nested-workflow steps in code-defined workflows as well — a stored parent workflow can reference a previously stored child and run it end to end through the standard workflow endpoints.

**`mastra` CLI:** regenerated API route metadata so the CLI's route table includes the new stored-workflow endpoints.
