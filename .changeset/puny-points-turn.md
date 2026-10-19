---
'@mastra/factory': patch
---

Added opt-in operation timing logs to Factory, to help find slow requests in deployed Factories. Set `FACTORY_TIMING=1` to log one `[factory:timing]` line to stderr for each HTTP request, each call on a Factory app storage domain (work items, projects, intake, audit and the other app tables), each workspace resolution, and each sandbox `start`, `stop`, `reconnect` and `executeCommand`. Agent storage (threads, messages, memory) is not timed. When the variable is unset none of these lines are written and nothing is wrapped; the existing boot-phase timing lines are unchanged.

```bash
FACTORY_TIMING=1 node server.js
# [factory:timing] http GET /web/sessions 200 42ms
# [factory:timing] storage.work-items.list 7ms
```
