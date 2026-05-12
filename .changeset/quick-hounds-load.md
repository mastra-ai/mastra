---
'mastracode': patch
---

Improved Mastra Code startup time by loading only the most recent thread messages during initial render, using app-specific local LibSQL PRAGMA tuning, and deferring browser setup, gateway sync, and update checks until after first render.
