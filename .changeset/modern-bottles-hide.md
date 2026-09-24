---
'mastracode': patch
---

Defaulted Observer and Reflector models to Auto so they follow the active main model's provider unless explicitly pinned. Observer and Reflector choices you already saved stay pinned after upgrading; choose Auto in `/om` to switch a role back. Added effective-model display and independent reset controls, and removed the observational-memory model choice from onboarding.

A model pack's memory model now has three states in `/models`: not set (uses your `/om` settings), Auto, or a specific model, which applies to both roles while the pack is active.
