---
'@mastra/sprites': minor
---

Added `@mastra/sprites`, a workspace sandbox provider for [Fly.io Sprites](https://sprites.dev). `SpritesSandbox` gets or creates a Sprite by name, so files persist across sessions, and runs commands with streaming output, timeouts, cancellation, and background processes with stdin. `stop()` keeps the Sprite, `destroy()` deletes it, and `snapshot()` captures a checkpoint. Requires Node.js 24 or later.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { SpritesSandbox } from '@mastra/sprites';

const workspace = new Workspace({
  sandbox: new SpritesSandbox({ id: 'mastra-project', token: process.env.SPRITES_TOKEN }),
});
```
