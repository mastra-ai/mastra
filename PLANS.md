## Overview

Project setup:

- Test project is at `_test-project`
  - Inside the test project you can run `pnpm dev` to run Mastra development server, and `pnpm build` to build the project.
- You can run `pnpm turbo build --filter="@mastra/deployer"` to build the `packages/deployer` package only
  - You can run `pnpm turbo watch build --filter="@mastra/deployer"` to watch for changes and rebuild automatically (this process does not exit automatically)
- The test project is used to validate the changes in the Mastra packages during development.

## Current behavior

### `pnpm dev`

After `pnpm dev`, the `.mastra` folder contains a `.build` folder and `output` folder. The `.build` folder and `output/tools/<tool-name>` contains files that have this import in them:

```js
import c from 'tinyrainbow';
```

This is because `_test-project/src/mastra/tools/weather-tool.ts` imports `tinyrainbow` directly.

`tinyrainbow` is not bundled into the output files because it's marked as "external".

### `pnpm build`

After `pnpm build`, the `.mastra/.build` folder contains a lot of files, including `_test-project/.mastra/.build/tinyrainbow.mjs`. This is because during build, `tinyrainbow` is bundled into that chunk. In the next step, that chunk will be put into `_test-project/.mastra/output/mastra.mjs`.

`tinyrainbow` is no longer marked as "external" during build, so it gets bundled.

## Desired behavior

A user should be able to define `externals: true` in the Mastra configuration like so:

```ts
export const mastra = new Mastra({
  bundler: {
    externals: true,
  },
});
```

(This is at `_test-project/src/mastra/index.ts` in the test project)

When a user defines `externals: true`, all dependencies should be marked as "external" both during `pnpm dev` and `pnpm build`. **EXCEPTION:** Inside a monorepo, `workspaceDependencies` should NOT be marked as external, they should always be bundled. **This is important!**

The end result should be:

- After `pnpm dev`, the output files in `.mastra/output` should have imports for external dependencies like `tinyrainbow`.
- After `pnpm build`, the output files in `.mastra/output` should also have imports for external dependencies like `tinyrainbow`. There should NOT be any bundled code for `tinyrainbow` in the output files.
