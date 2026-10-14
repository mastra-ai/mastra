import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';

export interface DefaultModelApplicableSession {
  model: { switch(modelId: string): Promise<unknown> };
  subagents: { model: { set(args: { modelId: string; agentType: string }): Promise<unknown> } };
}

export interface DefaultModelHydrationSession extends DefaultModelApplicableSession {
  readonly identity: { getResourceId(): string };
  model: DefaultModelApplicableSession['model'] & { setDefault(args: { modelId: string }): void };
  state: {
    get(): Record<string, unknown> | undefined;
    set(updates: Record<string, unknown>): Promise<unknown>;
  };
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
  sourceControl: Pick<SourceControlSessionLookup, 'getBySessionId'>;
  projects: Pick<FactoryProjectsStorage, 'getById'>;
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingByThread'>;
  modelDefaults: Pick<ModelDefaultsStorage, 'get'>;
}

/** Seed a new chat's scoped default model; a chat with a user message keeps its model. */
export async function hydrateSessionDefaultModel(
  session: DefaultModelHydrationSession,
  { sourceControl, projects, workItems, modelDefaults }: DefaultModelHydrationDependencies,
): Promise<void> {
  const resourceId = session.identity.getResourceId();
  const initialState = session.state.get() ?? {};
  if (initialState.factoryProjectId || typeof session.thread.firstUserMessage !== 'function') return;
  const hadFactoryIdentity = initialState.factoryModelScope === 'factory' || initialState.factoryModelScope === 'user';
  const clearFactoryIdentity = () =>
    session.state.set({ factoryOrgId: undefined, factoryModelScope: undefined, factoryOwnerUserId: undefined });
  const failClosedWithoutIdentity = () =>
    session.state.set({ factoryModelScope: 'user', factoryOwnerUserId: undefined });
  let identityResolved = false;
  try {
    const sourceSession = await sourceControl.getBySessionId(resourceId);
    if (!sourceSession) {
      await clearFactoryIdentity();
      return;
    }
    if (!sourceSession.factoryProjectId) {
      await clearFactoryIdentity();
      return;
    }
    const project = await projects.getById({ id: sourceSession.factoryProjectId });
    if (!project) {
      await clearFactoryIdentity();
      return;
    }

    const modelScope = project.modelScope === 'user' ? 'user' : 'factory';
    await session.state.set({
      factoryOrgId: sourceSession.orgId,
      factoryModelScope: modelScope,
      factoryOwnerUserId: sourceSession.userId,
    });
    identityResolved = true;
    await primeTenantCredentialsForTenant({
      orgId: sourceSession.orgId,
      userId: sourceSession.userId,
      credentialScope: modelScope,
    });

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

    const scopedModelId =
      modelScope === 'factory'
        ? project.defaultModelId
        : (await modelDefaults.get({ orgId: sourceSession.orgId, userId: sourceSession.userId }))?.modelId;
    if (!scopedModelId) return;
    // A thread the session creates later (the UI binding its conventional
    // thread after a thread-agnostic request opened the session) starts from
    // the session default, not from the thread hydrated here.
    session.model.setDefault({ modelId: scopedModelId });
    await applyDefaultModel(session, scopedModelId);
  } catch (error) {
    if (!identityResolved && !hadFactoryIdentity) {
      try {
        await failClosedWithoutIdentity();
      } catch {}
    }
    console.warn('[Factory default-model hydration] Unable to apply the scoped default model.', error);
  }
}
