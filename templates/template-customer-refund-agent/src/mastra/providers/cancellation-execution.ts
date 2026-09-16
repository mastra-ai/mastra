import { AsyncLocalStorage } from "node:async_hooks";

export interface TrustedCancellationScope {
  caseId: string;
  turnId: string;
  commandFingerprint: string;
}

const scope = new AsyncLocalStorage<TrustedCancellationScope>();

/** Only the registered workflow may lend this in-process capability to the
 * registered tool. Request input cannot construct it. */
export function withTrustedCancellationScope<T>(
  value: TrustedCancellationScope,
  operation: () => Promise<T>,
) {
  return scope.run(Object.freeze({ ...value }), operation);
}

export function activeTrustedCancellationScope() {
  return scope.getStore();
}
