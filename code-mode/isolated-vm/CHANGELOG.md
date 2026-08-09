# @mastra/isolated-vm

## 0.1.0

### Minor Changes

- Added `@mastra/isolated-vm`, a new package with `IsolatedVmCodeModeTransport` — a Code Mode transport that runs model-authored programs in an in-process V8 isolate (backed by `isolated-vm`). The isolate is the execution boundary, so no workspace sandbox is required: the program has no filesystem, network, or process access, and its only capabilities are the `external_*` tool functions bridged back to the host. ([#20359](https://github.com/mastra-ai/mastra/pull/20359))

  ```typescript
  import { createCodeMode } from '@mastra/core/tools';
  import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';

  const { tool, instructions } = createCodeMode({ tools }, new IsolatedVmCodeModeTransport({ memoryLimitMb: 128 }));
  ```

  Note: `isolated-vm` is a native addon, and on Node.js 20+ the host process must be started with `--no-node-snapshot` (for example `NODE_OPTIONS=--no-node-snapshot`). See the docs for setup details. Resolves https://github.com/mastra-ai/mastra/issues/20329.

### Patch Changes

- Updated dependencies [[`3f472b4`](https://github.com/mastra-ai/mastra/commit/3f472b468892a1ff14ccb43cc0343b86f7d8fd7d), [`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`35b929b`](https://github.com/mastra-ai/mastra/commit/35b929b7abc3d20d85c7985880960ac2d04a6c86), [`55c9e24`](https://github.com/mastra-ai/mastra/commit/55c9e248c27c1d72b5bb7e94ea6b8a3999eee49f), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`9b3626a`](https://github.com/mastra-ai/mastra/commit/9b3626aeb1d16fcd34b0a8e94c114ddb80a3b240), [`4696963`](https://github.com/mastra-ai/mastra/commit/469696312ac4c618bc8475b0c5ed7949b8a3455e), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`07f5b4b`](https://github.com/mastra-ai/mastra/commit/07f5b4ba9d608d88865030732e580298296adf99), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`723aa54`](https://github.com/mastra-ai/mastra/commit/723aa5437106bdb708ae03c0ef6b77aa11291e73), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/isolated-vm`, a new package with `IsolatedVmCodeModeTransport` — a Code Mode transport that runs model-authored programs in an in-process V8 isolate (backed by `isolated-vm`). The isolate is the execution boundary, so no workspace sandbox is required: the program has no filesystem, network, or process access, and its only capabilities are the `external_*` tool functions bridged back to the host. ([#20359](https://github.com/mastra-ai/mastra/pull/20359))

  ```typescript
  import { createCodeMode } from '@mastra/core/tools';
  import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';

  const { tool, instructions } = createCodeMode({ tools }, new IsolatedVmCodeModeTransport({ memoryLimitMb: 128 }));
  ```

  Note: `isolated-vm` is a native addon, and on Node.js 20+ the host process must be started with `--no-node-snapshot` (for example `NODE_OPTIONS=--no-node-snapshot`). See the docs for setup details. Resolves https://github.com/mastra-ai/mastra/issues/20329.

### Patch Changes

- Updated dependencies [[`ba369f2`](https://github.com/mastra-ai/mastra/commit/ba369f2a0aaf998da0d6aa033d26f64f96bef8ac), [`dcfed93`](https://github.com/mastra-ai/mastra/commit/dcfed93e1e256c6abfa792cbb7ca836f5d0e8638), [`2876e15`](https://github.com/mastra-ai/mastra/commit/2876e15b4d2f616a3bc1ed3af57d546c268384ce), [`598080f`](https://github.com/mastra-ai/mastra/commit/598080f224edb3f0f5b801035b067fac50a56a03)]:
  - @mastra/core@1.55.0-alpha.1
