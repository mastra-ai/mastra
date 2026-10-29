import { primeTenantCredentialsForTenant, resolveTenantProviderDefaultModel } from '../routes/tenant-credentials.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';

export interface DefaultModelApplicableSession {
  model: { switch(modelId: string): Promise<unknown> };
  subagents: { model: { set(args: { modelId: string; agentType: string }): Promise<unknown> } };
}

export interface DefaultModelHydrationSession extends DefaultModelApplicableSession {
  readonly identity: { getId(): string; getResourceId(): string };
  model: DefaultModelApplicableSession['model'] & { get(): string; setDefault(args: { modelId: string }): void };
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
  workItems: Pick<WorkItemsStorage, 'findRunBindingByThread'>;
  modelDefaults: Pick<ModelDefaultsStorage, 'get'>;
}

/** Seed a new chat's scoped default model; a chat with a user message keeps its model. */
export async function hydrateSessionDefaultModel(
  session: DefaultModelHydrationSession,
  { sourceControl, projects, workItems, modelDefaults }: DefaultModelHydrationDependencies,
): Promise<void> {
  const sessionId = session.identity.getId();
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
    const sourceSession = await sourceControl.getBySessionId(sessionId);
    if (!sourceSession) {
      await clearFactoryIdentity();
      return;
    }
    if (!sourceSession.factoryProjectId) {
      await clearFactoryIdentity();
      return;
    }
    // Historical thread membership keeps completed work items on Factory billing in hybrid scope.
    const threadId = session.thread.getId();
    const binding = threadId
      ? await workItems.findRunBindingByThread({
          orgId: sourceSession.orgId,
          threadId,
          resourceId,
          sessionId,
          rejectAmbiguous: true,
        })
      : null;
    const project = await projects.getById({ id: binding?.factoryProjectId ?? sourceSession.factoryProjectId });
    if (!project || project.orgId !== sourceSession.orgId) {
      await clearFactoryIdentity();
      return;
    }
    const modelScope = effectiveModelScope(project.modelScope, binding ? 'run' : 'session');
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

    if (binding) return;
    if (threadId && (await session.thread.firstUserMessage({ threadId }))) return;

    const scopedModelId =
      (modelScope === 'factory'
        ? project.defaultModelId
        : (await modelDefaults.get({ orgId: sourceSession.orgId, userId: sourceSession.userId }))?.modelId) ??
      // No chosen default: a connected provider's default, unless the current model is usable.
      (await resolveTenantProviderDefaultModel(
        { orgId: sourceSession.orgId, userId: sourceSession.userId, credentialScope: modelScope },
        session.model.get() || undefined,
      ).catch(error => {
        console.warn('[Factory default-model hydration] Unable to resolve a provider default model.', error);
        return undefined;
      }));
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
