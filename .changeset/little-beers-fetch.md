---
'mastracode': patch
---

Moved zod from peerDependencies to dependencies so the CLI ships its own zod version instead of relying on the user's installation. Fixes schema conversion errors when npm resolves to Zod 3.25.x.
