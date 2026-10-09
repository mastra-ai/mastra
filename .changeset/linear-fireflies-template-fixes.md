---
'@mastra/connect': patch
---

Fixed Linear tool calls failing on valid API responses: attachment tools now accept null creator emails, and cycle/project tools report GraphQL errors instead of crashing on validation. Fireflies transcript tools now handle `action_items` returned as either an array or a newline-joined string.
