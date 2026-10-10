---
'@mastra/convex': patch
---

**Redeploy your Convex schema and functions when you upgrade.** This version calls new observational memory server operations and adds an optional `supersededBy` field; against functions deployed from an older version, observational memory writes fail until you redeploy.

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap. Reflections and initialization now run as single server mutations, and every write checks that it targets the current generation. Older duplicate generations are marked superseded when a write targets them. Protection is complete once every process and the deployed functions run the new version.
