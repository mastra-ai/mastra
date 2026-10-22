---
'@mastra/e2b': patch
---

`sandbox.processes.list()` now also returns exited processes whose output hasn't been read yet, with their exit code, so a finished command stays visible until it is read. Running commands show the command you ran instead of the `/bin/bash -l -c` wrapper. Processes attached with `get(pid)` keep streaming output past 60 seconds.
