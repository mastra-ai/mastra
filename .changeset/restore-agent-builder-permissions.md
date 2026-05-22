---
'@mastra/server': patch
'@mastra/core': patch
---

Restore `agent-builder:*` permissions in the generated permission catalog. The FGA route policy coverage refactor (#16651) regenerated `permissions.generated.ts` from `SERVER_ROUTES`, but `AGENT_BUILDER_ROUTES` is intentionally excluded from that array (deferred-import for Cloudflare Workers compatibility, see #16499). As a result `agent-builder:read`, `agent-builder:write`, `agent-builder:execute`, and `agent-builder:*` were silently dropped from `PERMISSION_PATTERNS`, breaking typed `RoleMapping` configs that reference them. The permission generator now also walks `AGENT_BUILDER_ROUTES` so the catalog matches runtime FGA behavior, without changing the lazy-loading guarantee.
