import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';
import { resolveProviderOMDefault } from '@mastra/code-sdk/onboarding/packs';

import {
  factoryMemorySettingsUserId,
  type MemorySettingsRecord,
  type MemorySettingsStorage,
} from '../storage/domains/memory-settings/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { seedSessionOrg } from './org-seed.js';

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
  factoryOrgId?: string;
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
  projects: Pick<FactoryProjectsStorage, 'get'>;
  memorySettings: Pick<MemorySettingsStorage, 'get'>;
}

/**
 * Seed a freshly created controller session's tenant org and its
 * observational-memory settings from the owner's source-control row. Registered
 * as a blocking session-created listener so the seed lands before the caller can
 * start a run.
 *
 * The org seed matters beyond settings. Subconscious knowledge curation scopes
 * every node and record on `factoryOrgId`; before the SDK refusal guard,
 * missing it made curation substitute the session owner id. For web chat sessions
 * that is the agent controller's own id rather than a tenant, so curated
 * knowledge landed under an org rung no reader ever queries. Same rule as the
 * start coordinator: the org
 * comes from the row the session was created from, never improvised from an
 * owner id.
 *
 * Tagged sessions may be coordinator-owned runs or web sessions that only carry
 * browser-seeded Factory state. This path resolves their source-control row and
 * reapplies a stored project settings row when one exists. If no project row
 * exists, it preserves the coordinator's provider-aware fallback.
 * Sessions without a GitHub source-control row (e.g. chat-only channel sessions)
 * hydrate through `hydrateFactorySession` with their own resolved tenant.
 * Best-effort: failures are logged, never thrown.
 */
export async function hydrateSessionMemorySettings(
  session: MemorySettingsHydrationSession,
  { sourceControl, projects, memorySettings }: MemorySettingsHydrationDependencies,
): Promise<void> {
  const state = session.state.get() ?? {};
  const isFactoryRun = Boolean(state.factoryProjectId);
  try {
    const record = await sourceControl.sessions.getBySessionId(session.identity.getResourceId());
    // No row, or a row whose org is blank, leaves the session with no tenant.
    // Mark it rather than returning silently: an unmarked projectless factory
    // session is indistinguishable from a local one, and curation would file it
    // under the local scope — the same bug wearing a different rung.
    await seedSessionOrg(session, record?.orgId);
    if (!record) return;
    const factoryProjectId = isFactoryRun ? String(state.factoryProjectId) : undefined;
    const settings = await memorySettings.get({
      orgId: record.orgId,
      userId: factoryProjectId ? factoryMemorySettingsUserId(factoryProjectId) : record.userId,
    });
    // Coordinator hydration applies a provider-aware fallback when no project row
    // exists. Do not replace that fallback with the generic OM default here.
    if (factoryProjectId && !settings) return;
    const project = factoryProjectId ? await projects.get({ orgId: record.orgId, id: factoryProjectId }) : null;
    const provider = project?.defaultModelId?.split('/')[0];
    const fallbackOmModelId = provider
      ? resolveProviderOMDefault(provider, project.defaultModelId ?? undefined).modelId
      : undefined;
    await applyStoredMemorySettings(session, settings, fallbackOmModelId);
  } catch (error) {
    console.warn('[Factory memory-settings hydration] Unable to apply stored memory settings.', error);
    // A failed lookup is an unresolved org, not an absent one — unless the seed
    // already landed and a later step is what threw.
    if (!session.state.get()?.factoryOrgId) await seedSessionOrg(session, undefined);
  }
}
