---
'@mastra/core': minor
---

Added `@mastra/core/tools/provider-web-search`, a reader for results of a web search the provider ran itself.

These tools report the call in their result rather than their input: OpenAI's `webSearch` declares an empty input schema and answers with an `action`, while Anthropic's `webSearch_20250305` answers with a bare array of results. Reading both shapes by hand meant every UI guessing at provider payloads, so the reader now ships with the package.

```ts
import {
  isWebSearchToolName,
  webSearchAction,
  webSearchLinks,
  webSearchTarget,
} from '@mastra/core/tools/provider-web-search';

isWebSearchToolName('web_search_preview'); // true — the plain name and the suffixed ones providers use

const action = webSearchAction(result); // { type: 'openPage', url: 'https://mastra.ai/docs' }
webSearchTarget(action); // 'https://mastra.ai/docs' — the query (or queries), pattern or page, whichever the action carries
webSearchLinks(result); // [{ url: 'https://mastra.ai/docs', title: 'Agents', pageAge: '2 days' }]
```

`action.type` stays whatever the provider called it, so an action kind added later still reaches you with its target intact instead of breaking a closed union.
