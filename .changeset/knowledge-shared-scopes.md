---
'@mastra/core': minor
---

Knowledge storage can now share scopes with every reader. A store returns the declaration keys it declares itself from `listSharedScopeDeclarations()` (none by default), for example the scopes a hosted store's importers write to. Every run reads those scopes, lists their root scopes after its own at the root of `knowledge_list` and `knowledge_read`, and resolves their addresses and `scope#key` refs, so imported pages found by search read back. Stored scopes under those keys don't need declaring in config and no longer fail the declaration check. Sharing gives read access only: writing there still takes a role from the config's own declarations.
