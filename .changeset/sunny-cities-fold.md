---
'@mastra/factory': minor
---

Sped up new Factory agent sessions with warm repo base checkpoints. When a repository is connected, Factory now builds a base sandbox checkpoint (clone plus setup command) in the background, rebuilds it when pull requests merge to the default branch or pushes land there, and keeps it fresh via the periodic reconcile sweep. New sessions boot from the base checkpoint and skip the full clone and setup, falling back to the previous cold path when no checkpoint is available.
