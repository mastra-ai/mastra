---
'@mastra/memory': patch
---

Observational memory now runs its buffering, activation, observation, reflection, and config-override writes for a thread (or resource) one at a time within a process, and a due reflection goes ahead of other waiting writes. Agents and `Memory` instances that share a thread in one process no longer race each other's buffering, activation, and reflection commits, and a reflection is not held back behind a run of buffered-observation writes. Observer and Reflector model calls still run concurrently.
