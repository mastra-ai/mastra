---
'@mastra/playground-ui': patch
---

Redesigned the Studio span details panel so the most useful information is easier to find, especially in narrow columns.

- **Compact header**: the span type icon, title (model, entity, or span name), and duration share one row. A badge appears when the span failed or was retried.
- **Details, Input, Output, and Feedback tabs**: Input holds the payload and the tools the span was offered. Output holds errors, tripwire reasons, the payload, and tool calls. Details groups the model, token usage, timing, identifiers, metadata, and attributes.
- **The open tab stays open** when you select another span, and is kept in the URL (`tab=input`, `tab=output`).
- **Prompt changes as a diff**: processors that change the prompt show which messages they added or removed, next to the messages they kept.
- **Narrow panels**: tab labels collapse to icons below 380px, and long IDs are truncated with their copy button still visible.
- **Folded JSON**: Metadata and Attributes open folded.
- **Scrollable lists**: available tools sit in their own card, and tool and skill lists keep their scrollbar visible while they overflow.

`ScrollArea` accepts a new `alwaysShowScrollbar` prop that keeps the scrollbar visible whenever the content overflows.

`SpanDataPanelView` no longer accepts `isAnchor`. Trace-level IDs (session, request, user, organization, experiment) now show on every span that has them. `SpanTab` now also includes `'input'` and `'output'`; `SPAN_TABS` and `isSpanTab` are exported to validate it.

This release also fixes these span payload issues:

- LLM request processors now show the prompt they received as a readable message list instead of a collapsed JSON field.
- Processor payloads with no fields to format, such as `{ "shortCircuited": false }`, now show as a plain JSON block instead of a lone "Other fields" disclosure. The Preview/JSON toggle is hidden when both views would show the same content.
- Large JSON payloads (such as model span attributes with many tools) now fold every top-level value, and folds are kept when you switch to another span.
