---
'@mastra/deployer': patch
---

Preserve `patchedDependencies` when bundling the build output. `mastra build` regenerates a `pnpm-workspace.yaml` for `.mastra/output` by copying an allowlist of pnpm settings, which previously dropped `patchedDependencies`. The deploy-time `pnpm install` then reinstalled unpatched packages, silently discarding local patches (e.g. an `@ai-sdk/*` provider patch). The referenced patch files are now copied into `<output>/patches/`, their paths are rewritten relative to the output dir, and `allowUnusedPatches: true` is emitted so patches targeting packages absent from the bundled dependency tree don't fail the install.
