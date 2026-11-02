---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge explorer now turns `[[links]]` in page bodies into links. A link such as `[[docs:mastra#workflows/suspend-and-resume]]` shows the target page's name and opens that page when clicked; a link to a page that isn't loaded shows as quiet, unlinked text. Links inside code are left as written.

The graph also draws these body links as thin green lines between pages, with a "Linked in page body" legend row, so you can see how pages reference each other alongside parent → child lines and note mentions.

`MarkdownRenderer` accepts optional `remarkPlugins` and `components` props, added after its built-in ones, so a host can render custom syntax without losing the renderer's escaping.

A host supplies the span: `remarkKnowledgeLinks` marks each `[[ref]]` as a span carrying the ref under `KNOWLEDGE_REF_PROPERTY`, and `knowledgePageRefIndex(pages)` resolves it against the pages the host has loaded.

```tsx
import { knowledgePageRefIndex } from '@mastra/playground-ui/domains/knowledge/lib/pageRefs';
import { KNOWLEDGE_REF_PROPERTY, remarkKnowledgeLinks } from '@mastra/playground-ui/domains/knowledge/lib/remarkKnowledgeLinks';

const index = knowledgePageRefIndex(pages);
const RefSpan = ({ node, children }) => {
  const ref = node?.properties?.[KNOWLEDGE_REF_PROPERTY];
  const target = typeof ref === 'string' ? index.resolve(ref) : undefined;
  return target ? <a href={`#${target.id}`}>{target.name}</a> : <span>{children}</span>;
};

<MarkdownRenderer remarkPlugins={[remarkKnowledgeLinks]} components={{ span: RefSpan }}>
  {page.body}
</MarkdownRenderer>;
```
