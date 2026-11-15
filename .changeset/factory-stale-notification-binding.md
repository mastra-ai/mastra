---
'@mastra/factory': patch
---

Recover stale Factory session bindings before delivering notifications. Concurrent notifications reuse a replacement binding for the same role, while a successor-role handoff still prevents stale delivery.
