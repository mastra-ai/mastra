// Browser-safe re-export of `collectToolMocks`.
//
// The `@mastra/core/evals` barrel re-exports `evals/base.ts`, which imports
// `node:crypto` and the full Agent/Mastra/scorer runtime. Consumers that run in
// the browser (e.g. the playground trace dialogs) must not pull that in. This
// standalone subpath entry exposes only `collectToolMocks`, whose own deps are
// type-only, so the emitted chunk contains zero Node imports.
export { collectToolMocks } from '../evals/collect-tool-mocks';
