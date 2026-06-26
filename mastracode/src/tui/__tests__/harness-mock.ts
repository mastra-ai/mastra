import type { AgentController } from '@mastra/core/agent-controller';
import { vi } from 'vitest';

/**
 * Shared mock harness/session factory for TUI tests.
 *
 * The production wiring (see `tui/state.ts`) makes `state.session` the *same*
 * object as `harness.session`. Per-session behavior (thread lifecycle,
 * run-control, mode/model/state/suspensions, the event bus) lives on the
 * Session; only genuinely host-level operations (model catalog, workspace,
 * mode catalog) live on the Harness. This factory mirrors that split so tests
 * don't hand-roll divergent shapes that drift from the real API.
 *
 * Every method is a `vi.fn()` so tests can assert on calls or override return
 * values. Pass `overrides` to deep-merge custom session/harness behavior.
 */

type AnyRecord = Record<string, any>;

function deepMerge<T extends AnyRecord>(base: T, overrides?: AnyRecord): T {
  if (!overrides) return base;
  const result: AnyRecord = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const existing = result[key];
    if (
      existing &&
      typeof existing === 'object' &&
      !Array.isArray(existing) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof value !== 'function'
    ) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

export interface MockHarnessOptions {
  id?: string;
  resourceId?: string;
  threadId?: string | null;
  /** Deep-merged onto the default `session` mock. */
  session?: AnyRecord;
  /** Deep-merged onto the default `harness` mock (excluding `session`). */
  harness?: AnyRecord;
}

/**
 * Build a mock Session matching the real per-session surface. Includes the
 * domains the TUI reaches: identity, thread (lifecycle + reads), run, stream,
 * suspensions, model, mode, state, displayState, the event bus, and the
 * run-control methods (sendSignal, sendMessage, respondToToolSuspension, …).
 */
export function createMockSession(opts: MockHarnessOptions = {}) {
  const resourceId = opts.resourceId ?? opts.id ?? 'test-harness';
  let currentThreadId: string | null = opts.threadId ?? null;

  const base = {
    identity: {
      getResourceId: vi.fn(() => resourceId),
      getDefaultResourceId: vi.fn(() => resourceId),
    },
    thread: {
      getId: vi.fn(() => currentThreadId),
      list: vi.fn(async () => []),
      getById: vi.fn(async () => null),
      messages: vi.fn(async () => []),
      getSetting: vi.fn(async () => undefined),
      setSetting: vi.fn(async () => {}),
      create: vi.fn(async () => {
        currentThreadId = 'thread-new';
        return { id: currentThreadId, resourceId, title: 'New thread', createdAt: new Date(), updatedAt: new Date() };
      }),
      switch: vi.fn(async ({ threadId }: { threadId: string }) => {
        currentThreadId = threadId;
      }),
      clone: vi.fn(async () => ({ id: 'thread-clone', resourceId })),
      rename: vi.fn(async () => {}),
      delete: vi.fn(async () => {}),
      detachFromCurrent: vi.fn(() => {
        currentThreadId = null;
      }),
      set: vi.fn(({ threadId }: { threadId: string }) => {
        currentThreadId = threadId;
      }),
    },
    run: {
      isRunning: vi.fn(() => false),
      getRunId: vi.fn(() => null),
    },
    stream: {
      isActive: vi.fn(() => false),
      isOpen: vi.fn(() => false),
      activeRunId: vi.fn(() => null),
    },
    suspensions: {
      hasPending: vi.fn(() => false),
      has: vi.fn(() => false),
    },
    model: {
      get: vi.fn(() => 'anthropic/claude-sonnet-4-5'),
      hasSelection: vi.fn(() => true),
      displayName: vi.fn(() => 'claude-sonnet-4-5'),
    },
    mode: {
      get: vi.fn(() => 'build'),
      resolve: vi.fn(() => ({ id: 'build', defaultModelId: undefined })),
      switch: vi.fn(async () => {}),
    },
    state: {
      get: vi.fn(() => ({})),
      set: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
    },
    displayState: {
      get: vi.fn(() => ({ isRunning: false })),
    },
    subscribe: vi.fn(() => () => {}),
    emit: vi.fn(),

    // Run-control surface (moved off Harness onto Session).
    sendMessage: vi.fn(async () => {}),
    sendSignal: vi.fn(() => ({
      id: 'signal-1',
      type: 'user' as const,
      accepted: Promise.resolve({ accepted: true as const, runId: 'run-1' }),
    })),
    sendNotificationSignal: vi.fn(async () => ({ accepted: true, runId: 'run-1' })),
    steer: vi.fn(async () => {}),
    followUp: vi.fn(async () => {}),
    abort: vi.fn(),
    respondToToolSuspension: vi.fn(async () => {}),
    saveSystemReminderMessage: vi.fn(async () => null),
  };

  return deepMerge(base, opts.session);
}

/**
 * Build a mock Harness whose `session` is a {@link createMockSession}. Includes
 * the host-level surface the TUI reaches (model catalog, workspace, mode
 * catalog, resource ids). Returns the harness; read `harness.session` for the
 * shared session instance.
 */
export function createMockHarness(opts: MockHarnessOptions = {}) {
  const session = createMockSession(opts);

  const base = {
    session,
    listModes: vi.fn(() => []),
    listAvailableModels: vi.fn(async () => []),
    getWorkspace: vi.fn(() => undefined),
    hasWorkspace: vi.fn(() => false),
    resolveWorkspace: vi.fn(async () => undefined),
    getResolvedWorkspace: vi.fn(async () => undefined),
    getKnownResourceIds: vi.fn(async () => []),
    setResourceId: vi.fn(),
    // Host-level reads that now take the session as an explicit argument.
    getCurrentAgent: vi.fn(),
    getCurrentModelAuthStatus: vi.fn(async () => ({ hasAuth: true, apiKeyEnvVar: undefined })),
    loadOMProgress: vi.fn(async () => {}),
    getObservationalMemoryRecord: vi.fn(async () => null),
  };

  return deepMerge(base, opts.harness) as unknown as AgentController<Record<string, unknown>> & {
    session: ReturnType<typeof createMockSession>;
  };
}

/**
 * Build a partial TUI `state` whose `session` is the *same* object as
 * `harness.session` — matching production wiring. Spread extra fields via
 * `extra`. Cast the result to your context type at the call site.
 */
export function createMockState(opts: MockHarnessOptions & { extra?: AnyRecord } = {}) {
  const { extra, ...harnessOpts } = opts;
  const harness = createMockHarness(harnessOpts);
  return {
    harness,
    session: harness.session,
    ...extra,
  };
}
