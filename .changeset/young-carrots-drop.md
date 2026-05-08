---
'@mastra/core': minor
'@mastra/memory': minor
'@mastra/server': minor
---

Added a `visibility: 'all' | 'llm'` flag to chunks and message parts so processors can hide content from user-facing streams and UI memory responses while keeping it available to the agent loop and persisted memory.

A processor's `processOutputStream` can now return a chunk with `visibility: 'llm'` instead of returning `null`. The chunk continues through the pipeline so tools still execute and the in-memory message list still sees it, but it is filtered out of `fullStream`/`textStream`/`objectStream` (and any other user-facing readers built from them). The flag is propagated onto the resulting `MastraMessagePart` so it survives into the storage layer.

`memory.recall()` and `agent.getMemoryMessages()` accept a new `visibility` option:

- `visibility: 'all'` (default) returns every part — used by the agent loop and any in-process consumer that needs the LLM's full context.
- `visibility: 'ui'` returns only parts whose visibility is not `'llm'` — i.e. anything intended to be visible to the user.

The default memory HTTP endpoints (`GET /memory/threads/:threadId/messages`, the `/memory/network/...` aliases, and `GET /memory/search`) call `memory.recall({ visibility: 'ui' })` so a UI chat surface loading initial messages or running search will not render hidden processor output. The agent loop's `getMemoryMessages` calls `recall` without a `visibility` arg, so it continues to see every part.

The flag is optional and defaults to `'all'` — existing processors and chunks behave exactly as before. The new `filterMessagesByVisibility` / `isVisiblePart` helpers are also exported from `@mastra/core/agent` for custom endpoints that need the same behavior.

When `memory.recall({ visibility: 'ui', perPage, page })` is called with explicit numeric pagination and no semantic recall, the visibility filter is applied before slicing, so `total` and `hasMore` describe the visible result set and pages stay full until the last page. With semantic recall (`vectorSearchString`) or `perPage: false`, the filter is applied post-fetch and `total` / `hasMore` describe the raw fetched set.

**This is a UI presentation flag, not a redaction or privacy boundary.** Parts marked `visibility: 'llm'` are still persisted in storage and still returned to the agent loop / model on subsequent recalls — `'llm'` only suppresses them from the user-facing stream and UI-facing retrieval helpers. Do not use it for sensitive data handling.

```ts
// Hide a tool-call from the UI without breaking tool execution or memory.
class HideSkillsToolProcessor implements Processor {
  id = 'hide-skills-tool';
  name = 'Hide skills tool';
  async processOutputStream({ part }: { part: ChunkType }) {
    if (part.type === 'tool-call' && part.payload.toolName === 'skills') {
      return { ...part, visibility: 'llm' as const };
    }
    return part;
  }
}

// Fetch the UI view of a thread directly from memory.
const { messages } = await memory.recall({ threadId, visibility: 'ui' });
```
