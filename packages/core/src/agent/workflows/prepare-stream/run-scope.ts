import type { RunScope } from '../../../mastra/run-scope';

/**
 * Per-run scope shared between the steps of a single `createPrepareStreamWorkflow`
 * factory invocation.
 *
 * The evented workflow engine serializes step outputs (JSON.stringify/parse via the
 * storage layer and via the pubsub transport), which would strip class instances,
 * `Map`s, and closures. Instead of trying to make every cross-step ref serializable,
 * we park them on this typed key-value bag — same pattern as `_internal` in
 * `createAgenticExecutionWorkflow`. Step `execute` bodies read and write to this
 * scope directly via the keys in `./run-scope-keys.ts`.
 *
 * In the default direct execution path the scope is just a closure-local
 * `RunScope` instance created by the factory. On the evented path the same
 * instance is also tracked by the parent `Mastra` (see `Mastra.__createRunScope`
 * / `__getRunScope`), so it shares the run-scoped TTL sweep and explicit
 * unregister hooks that back the internal-workflow registration.
 *
 * Step outputs themselves return only JSON-safe markers (see each step's
 * outputSchema).
 *
 * The `OUTPUT` type parameter is retained for call-site compatibility and is
 * intentionally a phantom — the typed slot keys carry their own value types.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type PrepareStreamRunScope<OUTPUT = undefined> = RunScope;
