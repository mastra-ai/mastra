import { AsyncLocalStorage } from "node:async_hooks";
import type { CaseStore, DispatchRecord } from "./case-store";

/**
 * A workflow may project a mutable case only while it holds the durable
 * dispatch lease that started or resumed that exact turn. The scope is local
 * to the asynchronous workflow execution, so concurrent workers cannot lend
 * each other a token through request context or model input.
 */
export interface DispatchLeaseScope {
  dispatchId: string;
  caseId: string;
  turnId: string;
  leaseToken: string;
}

const dispatchLeaseScope = new AsyncLocalStorage<DispatchLeaseScope>();

function heartbeatIntervalMs() {
  if (process.env.NODE_ENV !== "test") return 10_000;
  const configured = Number(process.env.SUPPORT_TEST_DISPATCH_HEARTBEAT_MS);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : 10_000;
}

export function withDispatchLeaseScope<T>(
  scope: DispatchLeaseScope,
  operation: () => Promise<T>,
) {
  return dispatchLeaseScope.run(Object.freeze({ ...scope }), operation);
}

export function activeDispatchLeaseScope() {
  return dispatchLeaseScope.getStore();
}

/** Keeps a claimed dispatch alive around a slow Agent/workflow boundary. The
 * caller still owns every fenced projection; a lost heartbeat is reported so
 * it can stop before making a stale projection. */
export function renewDispatchLeaseWhileRunning(
  store: Pick<CaseStore, "renewDispatchLease">,
  dispatch: Pick<DispatchRecord, "id" | "leaseToken">,
) {
  let lostOwnership = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const renew = async () => {
    try {
      if (
        !dispatch.leaseToken ||
        !(await store.renewDispatchLease(dispatch.id, dispatch.leaseToken))
      )
        lostOwnership = true;
    } catch {
      lostOwnership = true;
    }
  };
  return {
    renew,
    start() {
      heartbeat = setInterval(() => void renew(), heartbeatIntervalMs());
      heartbeat.unref();
    },
    stop() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = undefined;
      }
    },
    get lostOwnership() {
      return lostOwnership;
    },
  };
}
