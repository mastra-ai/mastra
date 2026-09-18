---
'@mastra/createos': minor
---

Added a CreateOS sandbox provider for running Mastra workspace commands in isolated cloud sandboxes with process streaming, file uploads, native S3 filesystem mounts, lifecycle management, automatic stale-sandbox recovery, ingress URLs, and optional desktop computer controls.

```ts
import { CreateOSSandbox } from '@mastra/createos'

const sandbox = new CreateOSSandbox({
  id: 'project-1',
  autoPauseAfterSeconds: 900,
  ingress: true,
})
```
