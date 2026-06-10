type HarnessTestControls = {
  getCurrentThreadId?: () => string | null | undefined;
  getResourceId?: () => string | undefined;
  getState?: () => Record<string, unknown>;
  listThreads?: (options?: unknown) => unknown;
  setState?: (state: unknown) => unknown;
  setThreadSetting?: (setting: unknown, value?: unknown) => unknown;
  subscribe?: (eventHandler: unknown) => unknown;
};

type HarnessCaptureStore = {
  constructorCalls: unknown[][];
  controls?: HarnessTestControls;
};

const STORE_KEY = Symbol.for('mastracode.harnessTestCaptures');

function getStore(): HarnessCaptureStore {
  const globalWithStore = globalThis as typeof globalThis & { [STORE_KEY]?: HarnessCaptureStore };
  globalWithStore[STORE_KEY] ??= { constructorCalls: [] };
  return globalWithStore[STORE_KEY];
}

export function recordHarnessConfig(config: unknown): void {
  getStore().constructorCalls.push([config]);
}

export function getHarnessConstructorCalls(): unknown[][] {
  return getStore().constructorCalls;
}

export function resetHarnessCaptures(): void {
  const store = getStore();
  store.constructorCalls.length = 0;
  store.controls = undefined;
}

export function setHarnessTestControls(nextControls: HarnessTestControls): void {
  getStore().controls = nextControls;
}

export function getHarnessTestControls(): HarnessTestControls | undefined {
  return getStore().controls;
}
