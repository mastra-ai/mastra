---
'@mastra/valkey': patch
'@mastra/valkey-streams': patch
---

Tag Mastra-created Valkey connections with a `clientInfoTag` of `mastra`, so the server reports them as `GlideJS(mastra)` instead of a generic `GlideJS`. This makes it possible to tell which connections on a shared Valkey instance come from Mastra. The tag is only applied when Mastra creates the client itself: a user-supplied `clientInfoTag` in the connection config still takes precedence, and a client passed in via `{ client }` is left untouched. This also bumps `@valkey/valkey-glide` from `2.5.1` to `2.5.2`, the release that introduced the option.
