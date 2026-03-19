---
'@mastra/modal': minor
---

Added `@mastra/modal` — Modal cloud sandbox provider for Mastra workspaces.

Use `ModalSandbox` to run commands in an isolated Modal environment with pause/resume support:

```ts
import { Workspace } from '@mastra/core/workspace'
import { ModalSandbox } from '@mastra/modal'

const workspace = new Workspace({
  sandbox: new ModalSandbox({
    tokenId: process.env.MODAL_TOKEN_ID!,
    tokenSecret: process.env.MODAL_TOKEN_SECRET!,
  }),
})
```