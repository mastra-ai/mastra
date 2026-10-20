---
'@mastra/platform-workspace': minor
---

Added an opt-in `docker` sandbox setting. When it is on, E2B sandboxes get Docker Engine and Compose, and the daemon starts the first time something uses Docker. Sessions can then run `docker compose up` for local services such as Redis.

```ts
import { Template } from '@mastra/platform-workspace';

const template = Template().memoryMB(2048).docker();
```

In a factory, turn on the **Docker** switch in the sandbox settings, or pass `docker: true` to `createRepoTemplate`.

Docker is part of the template identity, so templates that leave it off keep their current IDs. Railway ignores the setting. E2B recommends at least 2 GB of memory for Docker.
