---
'@mastra/playground-ui': minor
---

Added an embedded code-block option to MarkdownRenderer for document views without separate code cards.

Use `<MarkdownRenderer codeBlockVariant="embedded">{instructions}</MarkdownRenderer>` to wrap code inside the document without a separate copy control. The default code-card presentation is unchanged.
