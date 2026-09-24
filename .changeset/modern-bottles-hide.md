---
'mastracode': patch
---

Defaulted Observer and Reflector models to Auto so they follow the active main model's provider unless explicitly pinned. Observer and Reflector choices you already saved stay pinned after upgrading, unless the active model pack sets its own memory model; choose Auto in `/om` to switch a role back. Added effective-model display and independent reset controls, and removed the observational-memory model choice from onboarding.

A model pack's memory model now has three states in `/models`: not set (uses your `/om` settings), Auto, or a specific model. A pack's memory model applies to both roles while the pack is active, including roles pinned in `/om`, and `/om` and the status line show the model it selects.
