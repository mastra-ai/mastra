---
"@mastra/auth-workos": patch
---

Added `mapUserToResourceId` to `MastraAuthWorkosOptions` so it can be set directly in the `MastraAuthWorkos` constructor. This maps an authenticated user to a resource id that multi-tenant tool providers use to bucket connected accounts (for example, Composio's `caller-supplied` scope). Previously the option was consumed at runtime but missing from the typed constructor surface, forcing a post-construction property assignment.
