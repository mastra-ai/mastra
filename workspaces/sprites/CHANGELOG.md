# @mastra/sprites

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/sprites`, a workspace sandbox provider for [Fly.io Sprites](https://sprites.dev). `SpritesSandbox` gets or creates a Sprite by name, so files persist across sessions, and runs commands with streaming output, timeouts, cancellation, and background processes with stdin. `stop()` keeps the Sprite, `destroy()` deletes it, and `snapshot()` captures a checkpoint. Requires Node.js 24 or later. ([#26650](https://github.com/mastra-ai/mastra/pull/26650))

  ```typescript
  import { Workspace } from '@mastra/core/workspace';
  import { SpritesSandbox } from '@mastra/sprites';

  const workspace = new Workspace({
    sandbox: new SpritesSandbox({ id: 'mastra-project', token: process.env.SPRITES_TOKEN }),
  });
  ```

### Patch Changes

- Updated dependencies [[`a65d0c7`](https://github.com/mastra-ai/mastra/commit/a65d0c788824081f36ccd95078a8d1214ff687c4), [`e89310a`](https://github.com/mastra-ai/mastra/commit/e89310a8db29a663a85c6a31a8c376cc8f59c129), [`590d6ca`](https://github.com/mastra-ai/mastra/commit/590d6ca9fa6ccf8b55dcf2e98da080ee1a348f67)]:
  - @mastra/core@1.76.0-alpha.9
