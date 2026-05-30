---
'@mastra/docker': minor
---

Added `name` option to `DockerSandbox` for setting the container's display name.

Previously, `DockerSandbox` did not forward a container name to Docker, so containers were created with random names like `gracious_tu` even though the docs implied `id` was used for naming. The new `name` option (defaults to `id`) is now passed to `docker run --name` and is sanitized to fit Docker's container-name rules (`[a-zA-Z0-9_.-]`).

```typescript
import { DockerSandbox } from '@mastra/docker';

// Before: container ended up with a random Docker-assigned name
new DockerSandbox({ id: 'user-1001' });

// After: the id is used as the container name by default
new DockerSandbox({ id: 'user-1001' });
// → docker ps shows 'user-1001'

// Or override explicitly
new DockerSandbox({ id: 'user-1001', name: 'tenant-acme-dev' });
```

Closes #17263.
