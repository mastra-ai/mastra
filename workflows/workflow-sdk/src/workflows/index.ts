/**
 * Entry point for the Workflow SDK compiler.
 *
 * Consumers create one file in their own `workflows/` directory that
 * re-exports this module, which is what gives the runner and its steps stable
 * ids in their build:
 *
 * ```ts
 * // workflows/mastra.ts
 * export * from '@mastra/workflow-sdk/workflows';
 * import '../src/mastra'; // side effect: registers your Mastra workflows
 * ```
 *
 * The side-effect import matters as much as the re-export: steps resolve the
 * live `Workflow` object out of the registry by id, so the definitions have to
 * have loaded in the process that runs the flow handler.
 *
 * Keep the relative specifiers below extensionless — the repo convention, and
 * also a requirement here. The Workflow SDK's discovery pass does not apply
 * TypeScript's `.js` -> `.ts` rewrite, so a `.js`-suffixed specifier anywhere
 * the directive files are reached through would silently drop them from
 * discovery: no build error, a `WorkflowNotRegisteredError` at run time. See
 * https://github.com/vercel/workflow/issues/3151.
 */
export { mastraRunner } from './runner';
export { emitMastraEvents, executeMastraOp } from './steps';
export { runMastraGraph, suspendToken } from './walker';
export type { MastraStreamEventLike, WalkerEffects, WalkerParams } from './walker';
