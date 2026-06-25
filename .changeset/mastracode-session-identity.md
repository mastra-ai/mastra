---
'mastracode': patch
---

MastraCode now passes a deterministic session `id` and `ownerId` to the Harness session. The session id is derived from the project resource ID and is stable across restarts for the same project directory. The owner id is derived from the machine hostname and project root path, tying the session to the local machine.
