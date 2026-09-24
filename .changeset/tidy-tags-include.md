---
'@mastra/core': minor
---

Added tag predicates to advanced trace queries. Trace predicates accept `includes` and `notIncludes` on the `tags` field, and `exists` / `notExists` on `tags` mean "at least one tag" / "no tags". Missing and empty tag lists are treated alike. `tags` also supports value discovery.

**Example**

```ts
{ op: 'includes', path: 'tags', value: 'manual-review' }
```
