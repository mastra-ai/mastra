# @mastra/mesa

## 0.2.0-alpha.0

### Minor Changes

- Added a Mesa filesystem provider for Mastra workspaces. ([#18740](https://github.com/mastra-ai/mastra/pull/18740))

  ```ts
  import { Workspace } from '@mastra/core/workspace';
  import { MesaFilesystem } from '@mastra/mesa';

  const workspace = new Workspace({
    filesystem: new MesaFilesystem({
      apiKey: process.env.MESA_API_KEY,
      org: 'acme',
      repos: [{ name: 'docs', bookmark: 'main' }],
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`cc440a3`](https://github.com/mastra-ai/mastra/commit/cc440a39400d8ce06655462b26c1666a1b3d4320), [`ea6327b`](https://github.com/mastra-ai/mastra/commit/ea6327ba2d63ca647804bc97b347e03a58617162), [`3439fa8`](https://github.com/mastra-ai/mastra/commit/3439fa836ecfcaa257b40c20b30ac2a8be22e9ea), [`85107f2`](https://github.com/mastra-ai/mastra/commit/85107f2758b527147fccbedff962961927c2d3b8), [`06ff9e0`](https://github.com/mastra-ai/mastra/commit/06ff9e0befd1d642ab87ff749285ee4091205c7e), [`7f5e1ff`](https://github.com/mastra-ai/mastra/commit/7f5e1ff695a92f672bb3976363925d1e9136b54a), [`b8375c1`](https://github.com/mastra-ai/mastra/commit/b8375c1f8fe905df8ae2ae9a893bb365f17aec4e), [`003f35d`](https://github.com/mastra-ai/mastra/commit/003f35d19e07b23b4bacc591c8bc0c59b42124ae)]:
  - @mastra/core@1.49.0-alpha.1

## 0.1.0

Initial release.
