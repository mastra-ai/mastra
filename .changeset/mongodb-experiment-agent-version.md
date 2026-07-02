---
'@mastra/mongodb': patch
---

Fixed `createExperiment` in the MongoDB store persisting `agentVersion` as `null` regardless of the input. `listExperiments` already accepts an `agentVersion` filter, but rows created by this backend would never match it. New experiments now round-trip `agentVersion` end-to-end.
