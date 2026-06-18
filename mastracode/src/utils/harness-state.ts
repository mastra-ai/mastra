type SessionStateApi<TState> = {
  get?: () => Readonly<TState>;
  set?: (updates: Partial<TState>) => Promise<void>;
  update?: <TResult>(updater: (state: Readonly<TState>) => unknown) => Promise<TResult>;
};

type HarnessStateSource<TState> = {
  session?: { state?: SessionStateApi<TState> };
  state?: Readonly<TState>;
  getState?: () => Readonly<TState>;
  setState?: (updates: Partial<TState>) => Promise<void>;
  updateState?: SessionStateApi<TState>['update'];
};

/**
 * Prefer session-owned harness state while keeping legacy getState/state mocks working in tests and integrations.
 */
export function readHarnessState<TState extends Record<string, unknown>>(
  source: unknown,
): Readonly<TState> | undefined {
  const harness = source as HarnessStateSource<TState> | undefined;
  return harness?.session?.state?.get?.() ?? harness?.getState?.() ?? harness?.state;
}

/**
 * Prefer session-owned harness state writes while preserving older setState mocks during migration.
 */
export async function writeHarnessState<TState extends Record<string, unknown>>(
  source: unknown,
  updates: Partial<TState>,
): Promise<void> {
  const harness = source as HarnessStateSource<TState> | undefined;
  const setter = harness?.session?.state?.set ?? harness?.setState;
  if (!setter) return;
  await setter(updates);
}

/**
 * Prefer session-owned transactional updates while preserving flattened request-context updateState wrappers.
 */
export async function updateHarnessState<TState extends Record<string, unknown>, TResult>(
  source: unknown,
  updater: (
    state: Readonly<TState>,
  ) => { updates?: Partial<TState>; events?: unknown[]; result: TResult } | Promise<{ updates?: Partial<TState>; events?: unknown[]; result: TResult }>,
): Promise<TResult> {
  const harness = source as HarnessStateSource<TState> | undefined;
  const update = harness?.session?.state?.update ?? harness?.updateState;
  if (update) return update(updater) as Promise<TResult>;

  const current = readHarnessState<TState>(harness);
  if (!current) throw new Error('Harness state is unavailable');
  const result = await updater(current);
  if (result.updates) await writeHarnessState(harness, result.updates);
  return result.result;
}
