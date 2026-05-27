---
'mastracode': patch
---

Improved heartbeat handler reliability in MastraCode. Handlers now start when the harness initializes and clean up on shutdown. Registering a heartbeat id that already exists now replaces the previous handler and runs its shutdown callback.
