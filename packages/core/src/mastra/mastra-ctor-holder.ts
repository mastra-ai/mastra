import type { Mastra } from './index';

/**
 * Holds the `Mastra` constructor so `Agent.#getOrCreateEphemeralMastra` can
 * build an ephemeral `Mastra` without a runtime `agent → mastra` import — which
 * would re-create the ESM init cycle documented at the top of `agent/agent.ts`
 * (`agent → mastra → agent/durable → agent`, breaking `class DurableAgent
 * extends Agent` with a TDZ error).
 *
 * `mastra/index.ts` populates this at its own module-load time. Because any app
 * that constructs a `Mastra` has already loaded that module, the constructor is
 * set before an agent could need it, so the `await import('../mastra')` fallback
 * in the agent never actually runs. The fallback exists only for a standalone
 * `new Agent()` used without ever loading the `Mastra` module.
 *
 * The import above is type-only, so this module has no runtime dependency on
 * `mastra/index.ts` and is safe for `agent.ts` to import at module scope.
 *
 * @internal
 */
export const mastraCtorHolder: { ctor?: new (config?: any) => Mastra } = {};

/**
 * Registers the `Mastra` constructor. Called once from `mastra/index.ts` at
 * module load. See {@link mastraCtorHolder}.
 *
 * @internal
 */
export function __registerMastraCtor(ctor: new (config?: any) => Mastra): void {
  mastraCtorHolder.ctor = ctor;
}
