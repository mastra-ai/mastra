---
'@mastra/connect': patch
---

Regenerate the Linear and Fireflies providers from NangoHQ/integration-templates#708. Linear attachment tools now accept null creator emails, and cycle/project tools surface GraphQL errors instead of failing schema validation. Fireflies transcript tools accept `action_items` as either an array or a newline-joined string.
