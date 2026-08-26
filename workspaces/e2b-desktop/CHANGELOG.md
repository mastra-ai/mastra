# @mastra/e2b-desktop

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/e2b-desktop`, a computer-use sandbox provider backed by E2B Desktop. It combines E2B command, process, file, and reconnection support with screenshot, mouse, keyboard, screen information, and authenticated noVNC tools. ([#21707](https://github.com/mastra-ai/mastra/pull/21707))

  ```typescript
  const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720] });
  const workspace = new Workspace({ sandbox });
  ```

  The provider also exports the underlying desktop SDK through `sandbox.desktop` for desktop-specific operations.

### Patch Changes

- Updated dependencies [[`5c2b379`](https://github.com/mastra-ai/mastra/commit/5c2b37916a045b578cc5f4321d99a16fda9117c6)]:
  - @mastra/e2b@0.10.0-alpha.5
