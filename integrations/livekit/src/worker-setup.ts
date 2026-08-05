/**
 * Coordination between worker definition and worker startup. LiveKit plugins register
 * their inference runners at module-import time, and the AgentServer only spawns the
 * inference process for runners registered before it starts — so plugin imports kicked
 * off by `createLiveKitWorker()` must complete before `runLiveKitWorker()` boots the
 * server.
 */
const pendingSetup: Promise<unknown>[] = [];
const requestedEouMethods = new Set<string>();

export function queueWorkerSetup(setup: Promise<unknown>): void {
  pendingSetup.push(setup);
}

export function workerSetupComplete(): Promise<unknown> {
  return Promise.allSettled(pendingSetup);
}

export function requestEouMethod(method: string): void {
  requestedEouMethods.add(method);
}

export function isEouMethodRequested(method: string): boolean {
  return requestedEouMethods.has(method);
}
