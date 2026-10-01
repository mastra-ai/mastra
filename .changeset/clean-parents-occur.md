---
'@mastra/memory': minor
---

**Page through observation groups.** Recall can now read the original observation groups around a search hit, including groups condensed away by reflection and buffered groups that haven't been activated yet. Existing records work without re-indexing.

```ts
recall({ mode: 'observations', groupId: 'group-id-from-search', direction: 'after', limit: 5 });
```

**Easier-to-read search results.** Search results are dated, listed oldest first, and mark where groups may be hidden between hits. Hits already in the agent's context come back as short references, so more new hits fit. When a long group is shortened, its excerpt starts at the line that best matches the query.

**Better recall guidance.** With retrieval enabled, the agent gets recall guidance from the first turn, including in read-only runs. It explains how to search, page, and confirm details against source messages, treats what the user said as authoritative and what the assistant proposed as a suggestion, and labels reflected groups as lossy summaries.
