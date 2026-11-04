import { AsyncLocalStorage } from 'node:async_hooks';
import { setRunFenceContext } from '../../storage/run-fencing';
import type { RunFenceScope } from '../../storage/run-fencing';

const runFenceScope = new AsyncLocalStorage<RunFenceScope | undefined>();

// Another copy of core may have installed its context first; share it so
// storage adapters loaded from either copy see the same scope.
const runFenceContext = setRunFenceContext({
  current: () => runFenceScope.getStore(),
  run: (scope, fn) => runFenceScope.run(scope, fn),
});

/**
 * Run `fn` with `scope` supplying the fence of every storage write it makes,
 * including writes from processors, tools and memory that never see the fence.
 */
export function runInRunFenceScope<T>(scope: RunFenceScope, fn: () => T): T {
  return runFenceContext.run(scope, fn);
}

/** The scope installed for the current async context, if any. */
export function currentRunFenceScope(): RunFenceScope | undefined {
  return runFenceContext.current();
}
