---
'@mastra/core': patch
---

Fix DurableAgent rewriting `image-url` tool-result parts into the Base64-only `media.data` shape. Stored `toModelOutput` content now keeps `image-url` parts (including their `providerOptions`) intact; spec-`v3` prompts consume them natively, spec-`v4` prompts map them to url-tagged `file` parts, and spec-`v2` prompts get the legacy best-effort `media` downgrade.
