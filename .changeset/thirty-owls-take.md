---
'@mastra/convex': patch
---

Fixed observational memory losing buffered observations or activated context when reflections, observation activation, and background buffering overlap. Reflections and initialization now run as single server mutations, and every write checks that it targets the current generation.

**Upgrading.** Redeploy your Convex schema and functions after upgrading: the observational memory table gains an optional `supersededBy` field and new server operations. Older duplicate generations are marked superseded when a write targets them. Protection is complete once every process and the deployed functions run the new version.
