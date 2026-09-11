---
'@mastra/core': patch
---

Workflow control-flow spans now carry the identity of the graph entry that created them, so observability tools can correlate a span with the authored operation instead of inferring it from structure.

- `.parallel()`, `.branch()`, `.dowhile()`, `.dountil()`, and `.foreach()` container spans use the authored entry `id` for their display name (e.g. `parallel: 'check-document'`) and expose the entry `id`, `description`, and `metadata` as span attributes (`entryId`, `entryDescription`, `entryMetadata`). Spans without an authored `id` keep their previous structural name as a fallback.
- `.sleep()` and `.sleepUntil()` spans keep their descriptive duration/date names and now expose the same identity attributes.
- `.map()` step spans now forward the entry `description` and `metadata` (they already exposed the entry `id`).

For example, given:

```ts
workflow.parallel([checkSpelling, checkGrammar], {
  id: 'check-document',
  metadata: { title: 'Check document' },
});
```

the container span is now named `parallel: 'check-document'` and its attributes include `entryId: 'check-document'` and `entryMetadata: { title: 'Check document' }`, letting an exporter display "Check document" and distinguish it from other parallel groups with the same branch count.
