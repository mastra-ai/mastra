import type { ExecuteFunctionParams } from '../step';

/**
 * The step execute context every per-kind executor receives — the same object
 * a plain step's `execute` gets. Widest generics: executors are shared by both
 * engines and the `createStepFrom*` factories, which erase per-step typing.
 */
export type EntryExecuteContext = ExecuteFunctionParams<any, any, any, any, any, any>;
