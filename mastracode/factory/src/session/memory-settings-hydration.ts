import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';

import type { MemorySettingsRecord, MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';

/** Default thresholds mirror the TUI `/om` fallbacks. */
export const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
export const DEFAULT_REFLECTION_THRESHOLD = 40_000;

/** One observational-memory role's read/switch surface. */
interface OMRoleSlice {
  modelId: () => string | undefined;
  switchModel: (args: { modelId: string }) => Promise<unknown>;
}

/**
 * Session-state fields memory-settings hydration writes. The index signatures
 * mirror `MastraCodeState` so the concrete `Session.state.set(Partial<MastraCodeState>)`
 * stays assignable to this minimal surface (contravariant parameter check).
 */
interface OMStateWrites {
  [key: string]: unknown;
  [key: `subagentModelId_${string}`]: string | undefined;
  observationThreshold?: number;
  reflectionThreshold?: number;
  observeAttachments?: 'auto' | boolean;
}

/** The slice of a session needed to apply stored observational-memory settings. */
export interface OMConfigurableSession {
  om: { observer: OMRoleSlice; reflector: OMRoleSlice };
  state: {
    get: () => Record<string, unknown> | undefined;
    set: (updates: OMStateWrites) => Promise<void> | void;
  };
}

/**
 * Apply a stored memory-settings row onto a session, so the DB — not whatever
 * happens to sit in persisted session state (e.g. a stale boot-time seed from
 * before memory settings moved to the DB) — is what the web surface reads and
 * what the session's OM actually runs with. The row is authoritative: knobs
 * without a stored value reset to the built-in defaults. This is the single
 * application path shared by the settings routes, coordinator hydration, and
 * the web session boot seed.
 */
export async function applyStoredMemorySettings(
  session: OMConfigurableSession,
  record: MemorySettingsRecord | null,
  fallbackOmModelId?: string,
): Promise<void> {
  for (const role of ['observer', 'reflector'] as const) {
    const stored = role === 'observer' ? record?.observerModelId : record?.reflectorModelId;
    const target = stored ?? fallbackOmModelId ?? DEFAULT_OM_MODEL_ID;
    if (session.om[role].modelId() !== target) {
      await session.om[role].switchModel({ modelId: target });
    }
  }
  const state = session.state.get() ?? {};
  const updates: OMStateWrites = {};
  const observationThreshold = record?.observationThreshold ?? DEFAULT_OBSERVATION_THRESHOLD;
  if (state.observationThreshold !== observationThreshold) {
    updates.observationThreshold = observationThreshold;
  }
  const reflectionThreshold = record?.reflectionThreshold ?? DEFAULT_REFLECTION_THRESHOLD;
  if (state.reflectionThreshold !== reflectionThreshold) {
    updates.reflectionThreshold = reflectionThreshold;
  }
  const observeAttachments = record?.observeAttachments ?? 'auto';
  if ((state.observeAttachments ?? 'auto') !== observeAttachments) {
    updates.observeAttachments = observeAttachments;
  }
  if (Object.keys(updates).length > 0) await session.state.set(updates);
}

export interface MemorySettingsHydrationSession extends OMConfigurableSession {
  readonly identity: { getResourceId(): string };
}

export interface MemorySettingsHydrationDependencies {
  /** GitHub-integration source-control rows — the only creator of web user sessions today. */
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  };
  memorySettings: Pick<MemorySettingsStorage, 'get'>;
}

/**
 * Seed a freshly created controller session's observational-memory settings
 * from the owner's stored `memory-settings` row. Registered as a blocking
 * session-created listener so the seed lands before the caller can start a run.
 *
 * Sessions tagged `factoryProjectId` (work/review runs, created with that tag)
 * hydrate through the start coordinator; sessions without a GitHub
 * source-control row (e.g. chat-only channel sessions) hydrate through
 * `hydrateFactorySession` with their own resolved tenant. Both are skipped
 * here. Best-effort: failures are logged, never thrown.
 */
export async function hydrateSessionMemorySettings(
  session: MemorySettingsHydrationSession,
  { sourceControl, memorySettings }: MemorySettingsHydrationDependencies,
): Promise<void> {
  if (session.state.get()?.factoryProjectId) return;
  try {
    const record = await sourceControl.sessions.getBySessionId(session.identity.getResourceId());
    if (!record) return;
    const settings = await memorySettings.get({ orgId: record.orgId, userId: record.userId });
    await applyStoredMemorySettings(session, settings);
  } catch (error) {
    console.warn('[Factory memory-settings hydration] Unable to apply stored memory settings.', error);
  }
}
