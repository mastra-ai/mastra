import type { MastraCodeState } from '@mastra/code-sdk/schema';

import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { hasResolvedOrg, seedSessionOrg } from './org-seed.js';

/** Default thresholds mirror the TUI `/om` fallbacks. */
export const DEFAULT_OBSERVATION_THRESHOLD = 30_000;
export const DEFAULT_REFLECTION_THRESHOLD = 40_000;

export interface MemorySettingsHydrationSession {
  readonly identity: { getId(): string };
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
    const record = await sourceControl.sessions.getBySessionId(session.identity.getId());
    await seedSessionOrg(session, record?.orgId);
    // A rebuilt session loses its Factory address, but its source-control row
    // still names it. Mirror `startUserSessionConversation`, which seeds the
    // project when the session is first created, so a restart keeps the
    // project's Knowledge scope instead of narrowing to the org alone.
    if (record?.factoryProjectId) {
      await session.state.set({
        factoryProjectId: record.factoryProjectId,
        ...(record.projectRepositoryId ? { projectRepositoryId: record.projectRepositoryId } : {}),
      });
    }
  } catch (error) {
    console.warn('[Factory session hydration] Unable to resolve the session organization.', error);
    if (!session.state.get()?.factoryOrgId) await seedSessionOrg(session, undefined);
  }
}
