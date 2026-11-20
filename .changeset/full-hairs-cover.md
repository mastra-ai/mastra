---
'@mastra/mongodb': patch
---

Fixed MongoDB pre-filter queries failing during BSON serialization for long IDs by bounding candidate bytes. Fixed filters on own `__proto__` metadata keys returning no matches. Documented BYO nested-metadata filter declarations when upgrading.
