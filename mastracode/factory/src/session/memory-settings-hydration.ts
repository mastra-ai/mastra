import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { hasResolvedOrg, seedSessionOrg } from './org-seed.js';

/** Default thresholds mirror the TUI `/om` fallbacks. */
export const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
export const DEFAULT_REFLECTION_THRESHOLD = 40_000;

export interface MemorySettingsHydrationSession {
  readonly identity: { getResourceId(): string };
  state: {
    get: () => MastraCodeState | undefined;
    set: (updates: Partial<MastraCodeState>) => Promise<void> | void;
  };
}

export interface MemorySettingsHydrationDependencies {
  /** GitHub-integration source-control rows — the only creator of web user sessions today. */
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  };
}

/**
 * Seed a freshly created controller session's tenant org from its source-control
 * row. Memory settings remain DB-authoritative and are loaded into request
 * context for each invocation instead of being copied into mutable session
 * state.
 */
export async function hydrateSessionMemorySettings(
  session: MemorySettingsHydrationSession,
  { sourceControl }: MemorySettingsHydrationDependencies,
): Promise<void> {
  const state: Partial<MastraCodeState> = session.state.get() ?? {};
  const isFactoryRun = Boolean(state.factoryProjectId);
  if (isFactoryRun && hasResolvedOrg(state.factoryOrgId)) return;

  try {
    const record = await sourceControl.sessions.getBySessionId(session.identity.getResourceId());
    await seedSessionOrg(session, record?.orgId);
  } catch (error) {
    console.warn('[Factory session hydration] Unable to resolve the session organization.', error);
    if (!session.state.get()?.factoryOrgId) await seedSessionOrg(session, undefined);
  }
}
