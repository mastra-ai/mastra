---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fix organization scoping for Subconscious knowledge capture.

Every factory session-creation path now seeds the authoritative organization id into
session state, and a path that cannot resolve one marks the session unresolved. The code
SDK no longer promotes a session owner id into the organization slot: a factory-owned
session with no resolvable organization disables knowledge capture and logs once instead
of writing into a scope the read path can never resolve, and local (TUI/studio) use
captures under an explicit local scope.
