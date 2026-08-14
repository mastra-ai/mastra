---
'@mastra/observability': patch
---

Fixed tracing silently deleting user data whose keys happened to match internal names like `steps`, `execute`, `validate`, or `providerMetadata`.

`deepClean` stripped a hardcoded set of keys from every object at every depth of a span's input, output, attributes, and metadata. Those are common domain words, so a tool whose args contained `recipe.steps` — or a planner, workflow, or wizard tool with a `steps`/`validate` field — had that field removed from the recorded trace with no marker. The trace read as if the caller never sent it.

Now user-authored payloads (tool args and results, workflow step input/output) round-trip into traces intact. The verbose AI-SDK result artifacts (`steps`, provider metadata) are still stripped, but only on the framework's own LLM/model spans where they originate — never from user data.

**Before**

```ts
// tool input: { plan: { title: 'Trip', steps: [...], validate: true } }
// recorded span input: { plan: { title: 'Trip' } }   // steps + validate silently gone
```

**After**

```ts
// recorded span input: { plan: { title: 'Trip', steps: [...], validate: true } }   // intact
```
