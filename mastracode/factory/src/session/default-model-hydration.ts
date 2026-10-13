import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { SourceControlSessionLookup } from './factory-session.js';
import { resolveFactoryDefaultModelId, resolveFactoryProjectForSession } from './factory-session.js';
import type { ModelSelectionSession } from './seed-model-selection.js';
import { readSeededModelSelection, seedModelSelection } from './seed-model-selection.js';

export interface DefaultModelHydrationSession extends Omit<ModelSelectionSession, 'state' | 'thread'> {
  readonly identity: { getResourceId(): string };
  state: { get(): Readonly<Record<string, unknown>> | undefined } & ModelSelectionSession['state'];
  thread: ModelSelectionSession['thread'] & {
    getId(): string | null | undefined;
    listActiveMessages(args: { limit: number }): Promise<unknown[]>;
  };
}

export interface DefaultModelHydrationDependencies {
  sourceControl: { sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'getSourceControlBySessionId'> };
  workItems: Pick<WorkItemsStorage, 'findActiveRunBindingByThread'>;
  modelDefaults: Pick<ModelDefaultsStorage, 'get'>;
  projects: Pick<FactoryProjectsStorage, 'getById'>;
}

/**
 * Seed a new interactive thread with its owner's default pair, else the Factory's default model.
 * A thread that was already seeded or already has messages keeps what it has, so
 * later default changes never move an existing chat.
 */
export async function hydrateSessionDefaultModel(
  session: DefaultModelHydrationSession,
  { sourceControl, workItems, modelDefaults, projects }: DefaultModelHydrationDependencies,
): Promise<void> {
  const resourceId = session.identity.getResourceId();
  if (session.state.get()?.factoryProjectId) return;
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
    if (await readSeededModelSelection(session)) return;
    if ((await session.thread.listActiveMessages({ limit: 1 })).length > 0) return;

    const personalDefault = await modelDefaults.get({ orgId: sourceSession.orgId, userId: sourceSession.userId });
    if (personalDefault) {
      await seedModelSelection(
        session,
        { modelId: personalDefault.modelId, thinkingLevel: personalDefault.thinkingLevel },
        'personal',
      );
      return;
    }

    const sourceControlHandle = await sourceControl.sessions.getSourceControlBySessionId(resourceId);
    const owner = sourceControlHandle
      ? await resolveFactoryProjectForSession({ sourceControl: sourceControlHandle, sessionId: resourceId })
      : null;
    const factoryModelId = await resolveFactoryDefaultModelId(projects, owner?.factoryProjectId);
    if (factoryModelId) await seedModelSelection(session, { modelId: factoryModelId, thinkingLevel: null }, 'factory');
  } catch (error) {
    console.warn('[Factory default-model hydration] Unable to apply the default model.', error);
  }
}
