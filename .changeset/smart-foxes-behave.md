---
'@mastra/core': patch
---

Fixed an evented workflow loop whose body is a single step hanging after the run was restarted, for example by recovery after a crash. This happened on storage that enforces step guards, such as Postgres and LibSQL. The loop now continues with its next iteration and the run finishes.
