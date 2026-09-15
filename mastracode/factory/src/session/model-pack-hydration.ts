import type { ActiveModelPackRecord, ModelPacksStorage } from '../storage/domains/model-packs/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface ModelPackApplicableSession {
  mode: { get(): string };
  model: { switch(args: { modelId: string }): Promise<unknown> };
  subagents: { model: { set(args: { modelId: string; agentType: string }): Promise<unknown> } };
  thread: {
    getSetting?(args: { key: string }): Promise<unknown>;
    setSetting(args: { key: string; value: unknown }): Promise<unknown>;
  };
}

export interface ModelPackHydrationSession extends ModelPackApplicableSession {
  readonly identity: { getResourceId(): string };
  state: { get(): Record<string, unknown> | undefined };
  thread: ModelPackApplicableSession['thread'] & {
    getId(): string | null | undefined;
    getSetting(args: { key: string }): Promise<unknown>;
  };
}

export async function applyActiveModelPack(
  session: ModelPackApplicableSession,
  activePack: Pick<ActiveModelPackRecord, 'packId' | 'models'>,
): Promise<void> {
  for (const [modeId, modelId] of Object.entries(activePack.models)) {
    await session.thread.setSetting({ key: `modeModelId_${modeId}`, value: modelId });
  }

  const currentMode = session.mode.get();
  const currentModeModel =
    currentMode === 'build' || currentMode === 'plan' || currentMode === 'fast'
      ? activePack.models[currentMode]
      : undefined;
  if (currentModeModel) {
    await session.model.switch({ modelId: currentModeModel });
  }

  const subagentModels = [
    ['explore', activePack.models.fast],
    ['plan', activePack.models.plan],
    ['execute', activePack.models.build],
  ] as const;
  for (const [agentType, modelId] of subagentModels) {
    await session.subagents.model.set({ modelId, agentType });
  }

  await session.thread.setSetting({ key: 'activeModelPackId', value: activePack.packId });
}

export interface ModelPackHydrationDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  };
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingByThread'>;
  modelPacks: Pick<ModelPacksStorage, 'getActive'>;
}

/** Seed the user's default pack unless the interactive thread already selected its own pack. */
export async function hydrateSessionModelPack(
  session: ModelPackHydrationSession,
  { sourceControl, workItems, modelPacks }: ModelPackHydrationDependencies,
): Promise<void> {
  const resourceId = session.identity.getResourceId();
  if (session.state.get()?.factoryProjectId || typeof session.thread.getSetting !== 'function') return;
  try {
    const sourceSession = await sourceControl.sessions.getBySessionId(resourceId);
    if (!sourceSession) return;
    const threadId = session.thread.getId();
    if (
      threadId &&
      (await workItems.findActiveRunBindingByThread({
        orgId: sourceSession.orgId,
        threadId,
        resourceId,
        sessionId: resourceId,
      }))
    ) {
      return;
    }
    const existingThreadSettings = await Promise.all([
      session.thread.getSetting({ key: 'activeModelPackId' }),
      session.thread.getSetting({ key: 'modeModelId_build' }),
      session.thread.getSetting({ key: 'modeModelId_plan' }),
      session.thread.getSetting({ key: 'modeModelId_fast' }),
    ]);
    if (existingThreadSettings.some(setting => typeof setting === 'string')) return;

    const activePack = await modelPacks.getActive({ orgId: sourceSession.orgId, userId: sourceSession.userId });
    if (activePack) await applyActiveModelPack(session, activePack);
  } catch (error) {
    console.warn('[Factory model-pack hydration] Unable to apply the active model pack.', error);
  }
}
