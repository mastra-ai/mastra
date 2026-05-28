---
'@mastra/core': minor
---

Storage adapters can now receive a narrow back-pointer to the Mastra instance
via `MastraCompositeStore.__registerMastra`. This mirrors the existing
registration pattern on agents, workflows, memory, scorers and processors,
and lets a storage domain look up agents and editor config without pulling
the full Mastra type into the storage layer (which would create a circular
import).

The reference is cascaded automatically to any parent composites and owned
domain stores, and is wired both during Mastra construction and via
`setStorage`. The editor is registered after storage so editor-driven
storage overlays observe the assigned storage.

A new `StorageMastraRef` interface exposes only the methods storage needs
today (`getAgentById`, `getEditor`).
