---
'@mastra/core': minor
'@mastra/server': minor
---

Added a `visibility: 'all' | 'llm'` flag to chunks and message parts so processors can hide content from the user-facing stream and from UI-facing memory retrieval while keeping it in the agent loop, message list, and persisted memory.

A processor's `processOutputStream` can now return a chunk with `visibility: 'llm'` instead of returning `null`. The chunk continues through the pipeline so tools still execute and message-building still sees it, but it is filtered out of `fullStream`/`textStream`/`objectStream` (and any other user-facing readers built from them). The flag is propagated onto the resulting `MastraMessagePart` so it survives into persisted memory.

The default memory HTTP endpoints (`GET /memory/threads/:threadId/messages`, the `/memory/network/...` aliases, and `GET /memory/search`) automatically strip parts marked `visibility: 'llm'` from their responses, so a UI chat surface loading initial messages or running search will not render hidden processor output. In-process callers (`memory.recall()`, the agent loop's initial-message fetch, semantic recall, etc.) are unchanged and continue to see all parts so the LLM keeps full context.

The flag is optional and defaults to `'all'` — existing processors and chunks behave exactly as before. The new `filterMessagesByVisibility` / `isVisiblePart` helpers are also exported from `@mastra/core/agent` for custom endpoints that need the same behavior.

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

// In a custom memory endpoint, strip llm-only parts before serving the UI.
import { filterMessagesByVisibility } from '@mastra/core/agent';
const uiMessages = filterMessagesByVisibility(await memory.getMessages());
```
