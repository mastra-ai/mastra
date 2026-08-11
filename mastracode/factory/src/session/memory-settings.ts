import { DEFAULT_OM_MODEL_ID } from '@mastra/code-sdk/constants';

import { tenantOrgId } from '../routes/provider-credentials.js';
import type { MemorySettingsRecord } from '../storage/domains/memory-settings/base.js';

/** Default thresholds mirror the TUI `/om` fallbacks. */
export const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
export const DEFAULT_REFLECTION_THRESHOLD = 40_000;

/**
 * Session-state fields the OM settings write. The index signatures mirror
 * `MastraCodeState` so the concrete `Session.state.set(Partial<MastraCodeState>)`
 * stays assignable to this minimal surface (contravariant parameter check).
 */
export interface OMStateWrites {
  [key: string]: unknown;
  [key: `subagentModelId_${string}`]: string | undefined;
  observationThreshold?: number;
  reflectionThreshold?: number;
  observeAttachments?: 'auto' | boolean;
}

interface MemorySettingsOMRole {
  modelId: () => string | undefined;
  switchModel: (args: { modelId: string }) => Promise<void>;
}

/** Minimal session surface the memory settings are applied to. */
export interface MemorySettingsSession {
  state: {
    get: () => Record<string, unknown> | undefined;
    set: (updates: OMStateWrites) => Promise<void> | void;
  };
  om: { observer: MemorySettingsOMRole; reflector: MemorySettingsOMRole };
}

/**
 * The `(org, user)` key of a caller's memory-settings row: one row per user,
 * or a sentinel `(local, local)` row when no auth provider is active.
 * `undefined` when auth is on but the caller could not be identified — the
 * only case where settings must not be read or written.
 */
export function resolveMemorySettingsIdentity({
  tenant,
  authEnabled,
}: {
  tenant: { orgId?: string; userId: string } | undefined;
  authEnabled: boolean;
}): { orgId: string; userId: string } | undefined {
  if (tenant) return { orgId: tenantOrgId(tenant), userId: tenant.userId };
  return authEnabled ? undefined : { orgId: 'local', userId: 'local' };
}

/**
 * Apply the stored memory-settings row onto a session, so the DB — not whatever
 * happens to sit in persisted session state (e.g. a stale boot-time seed, or a
 * long-lived session created before the user changed the setting) — is what the
 * session's OM actually runs with. The row is authoritative: knobs without a
 * stored value reset to the built-in defaults. Writes only on a real difference,
 * so re-applying every run costs nothing.
 */
export async function applyMemorySettingsToSession(
  session: MemorySettingsSession,
  record: MemorySettingsRecord | null,
): Promise<void> {
  for (const role of ['observer', 'reflector'] as const) {
    const stored = role === 'observer' ? record?.observerModelId : record?.reflectorModelId;
    const target = stored ?? DEFAULT_OM_MODEL_ID;
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
