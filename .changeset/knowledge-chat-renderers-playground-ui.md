---
'@mastra/playground-ui': patch
'mastra': patch
---

Pinned Knowledge now shows in chat as a card instead of raw `{id: …}` text. A snapshot reads "Pinned knowledge · N pages" and lists each pinned page by name and scope, with the text the agent was given behind a toggle. A delta lists the pages added (+), changed (~) and removed (−) since. A `[[Page Name]]` in a Knowledge note links to that page; a name that no longer resolves shows as plain text.

Knowledge page links go to Studio's Knowledge page by default. A host with its own Knowledge route wraps chat in `KnowledgeLinksProvider` to point them there:

```tsx
import { KnowledgeLinksProvider } from '@mastra/playground-ui/domains/chat/knowledge';

<KnowledgeLinksProvider pageHref={pageId => `/my-app/knowledge?page=${encodeURIComponent(pageId)}`}>
  <Chat />
</KnowledgeLinksProvider>;
```
