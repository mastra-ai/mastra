import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';

export interface DefaultModelApplicableSession {
  model: { switch(modelId: string): Promise<unknown> };
  subagents: { model: { set(args: { modelId: string; agentType: string }): Promise<unknown> } };
}

export interface DefaultModelHydrationSession extends DefaultModelApplicableSession {
  readonly identity: { getResourceId(): string };
  state: { get(): Record<string, unknown> | undefined };
  thread: {
    getId(): string | null | undefined;
    firstUserMessage(args: { threadId: string }): Promise<unknown>;
  };
}

async function applyDefaultModel(session: DefaultModelApplicableSession, modelId: string): Promise<void> {
  await session.model.switch(modelId);

  for (const agentType of ['explore', 'plan', 'execute']) {
    await session.subagents.model.set({ modelId, agentType });
  }
}

export interface DefaultModelHydrationDependencies {
  sourceControl: {
    sessions: Pick<SourceControlStorageHandle['sessions'], 'getBySessionId'>;
  };
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingByThread'>;
  modelDefaults: Pick<ModelDefaultsStorage, 'get'>;
}

/** Seed the user's default model into a new interactive chat; a chat with a user message keeps its model. */
export async function hydrateSessionDefaultModel(
  session: DefaultModelHydrationSession,
  { sourceControl, workItems, modelDefaults }: DefaultModelHydrationDependencies,
): Promise<void> {
  const resourceId = session.identity.getResourceId();
  if (session.state.get()?.factoryProjectId || typeof session.thread.firstUserMessage !== 'function') return;
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
    if (threadId && (await session.thread.firstUserMessage({ threadId }))) return;

    const modelDefault = await modelDefaults.get({ orgId: sourceSession.orgId, userId: sourceSession.userId });
    if (modelDefault) await applyDefaultModel(session, modelDefault.modelId);
  } catch (error) {
    console.warn('[Factory default-model hydration] Unable to apply the user default model.', error);
  }
}
