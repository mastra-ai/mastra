import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { IntegrationTools } from '../integrations/base.js';
import { USER_SESSION_BRANCH_PREFIX } from '../routes/source-control-sessions.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { FactoryStartTransitionError, WorkItemRepositoryError } from '../rules/start-coordinator.js';
import type { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactorySessionModel,
} from '../session/factory-session.js';
import { recordSessionRunStart } from '../session/run-audit.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { deliverFactorySessionNotification } from './deliver.js';
import type { FactoryMessaging } from './messaging-tools.js';
import { findWorkItem, workItemNotFound, workItemNumber, workItemRefSchema } from './read-tools.js';
import { heartbeatOpenRunUntilEnd } from './run-watch.js';
import type { FactoryToolScope } from './scope.js';

const TITLE_LENGTH = 120;

/** Who renews the open-run entries this process writes; one id per process, like the dispatcher's. */
export const FACTORY_TOOLS_OWNER_ID = `factory-tools:${globalThis.crypto.randomUUID()}`;

export interface FactorySessionToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'getSourceControlBySessionId'>;
  sessionModel: { projects: FactoryProjectsStorage; modelDefaults: ModelDefaultsStorage };
  /** Resolved lazily: the controller only exists once the mount is up. */
  messaging: () => Promise<FactoryMessaging | null>;
  workItems: Pick<
    WorkItemsStorage,
    | 'list'
    | 'getForProject'
    | 'listRunBindings'
    | 'subscribeToWorkItem'
    | 'unsubscribeFromWorkItem'
    | 'listSessionSubscriptions'
    | 'listWorkItemSubscribers'
  >;
  boards: BoardRegistry;
  auditRecorder: AuditRecorder;
  intake?: Pick<IntakeStorage, 'getConfig'>;
  /** The browser Start's coordinator; absent until the Factory runtime is ready. */
  startCoordinator: () => Pick<FactoryStartCoordinator, 'prepare'> | undefined;
}

function ambiguousRepository(candidates: readonly string[]): string {
  return `This item has several repositories (${candidates.join(', ')}); v1 can't choose one.`;
}

function startErrorMessage(error: unknown): string | null {
  if (error instanceof WorkItemRepositoryError) {
    return error.code === 'repository_ambiguous' ? ambiguousRepository(error.candidates) : error.message;
  }
  if (error instanceof FactoryStartTransitionError) return `The start was refused: ${error.result.reason}`;
  return null;
}

function workItemLabel(item: WorkItemRow): string {
  const number = workItemNumber(item);
  return number === null ? `"${item.title}"` : `#${number}`;
}

function titleFrom(prompt: string): string {
  const firstLine = prompt.split('\n').find(line => line.trim()) ?? prompt;
  return firstLine.trim().slice(0, TITLE_LENGTH);
}

/** Tools that start sessions on the caller's behalf. Interactive user turns only. */
export function createFactorySessionTools(
  scope: FactoryToolScope,
  deps: FactorySessionToolDependencies,
): IntegrationTools {
  const start = createTool({
    id: 'factory_start_session',
    description: [
      'Start a side session in this Factory with a prompt. It runs on its own sandbox and branch as you, and reports back to this session with `factory-session` notifications.',
      'Use it for self-contained investigations; when the result should land as a pull request, file a work item instead.',
      'With `workItem` and `role` it starts that role on the work item instead, without moving the card, and this session follows the item.',
      "A role that already has a session on the item (current or past) can't be started again from here: message that session with factory_signal_session, or ask the person to use the board.",
    ].join(' '),
    inputSchema: z
      .object({
        prompt: z.string().trim().min(1).max(8000).describe('The first message the new session receives.'),
        title: z.string().trim().min(1).max(TITLE_LENGTH).optional(),
        workItem: workItemRefSchema.optional(),
        role: z.string().trim().min(1).max(64).optional(),
      })
      .strict()
      .refine(input => input.role === undefined || input.workItem !== undefined, {
        message: 'Pass workItem together with role.',
        path: ['role'],
      }),
    execute: async ({ prompt, title, workItem, role }) => {
      if (workItem !== undefined) return startWorkItemRole({ prompt, title, workItem, role });

      const parent = await deps.sessions.getBySessionId(scope.sessionId);
      const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
      if (!parent || !sourceControl) throw new Error('This session has no Factory session row to start from.');
      const messaging = await deps.messaging();
      if (!messaging) throw new Error('Starting sessions is not available on this server.');

      const sessionId = globalThis.crypto.randomUUID();
      const ensured = await ensureFactorySourceSession({
        sourceControl,
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        sessionId,
        branch: `${USER_SESSION_BRANCH_PREFIX}${sessionId}`,
        // Bills the caller: the credential tenant follows the row's user.
        attributeToUserId: scope.userId,
        // Same repository as the session that started it.
        ...(parent.projectRepositoryId ? { projectRepositoryId: parent.projectRepositoryId } : {}),
        visibility: parent.visibility,
        origin: { sessionId: scope.sessionId, threadId: scope.threadId },
      });
      const sessionModel = await resolveFactorySessionModel({
        ...deps.sessionModel,
        factoryProjectId: scope.factoryProjectId,
        orgId: scope.orgId,
        ownerUserId: scope.userId,
        // No work item, so an interactive session: a hybrid Factory bills it as one.
        context: 'session',
      });

      // Only the new row's owner as `user`. The tool call's context carries the
      // interactive marker and the parent's controller entry; neither may reach the child.
      const kickoffContext = new RequestContext();
      kickoffContext.set('user', { workosId: scope.userId, organizationId: scope.orgId });

      const tags = { factoryProjectId: scope.factoryProjectId, projectRepositoryId: ensured.projectRepositoryId };
      const session = await messaging.controller.createSession({
        id: ensured.sessionId,
        ownerId: scope.userId,
        resourceId: ensured.sessionId,
        threadId: ensured.sessionId,
        requestContext: kickoffContext,
        tags,
      });
      await session.state.set(tags);
      await hydrateFactorySession(session, {
        orgId: scope.orgId,
        modelScope: sessionModel.modelScope,
        ownerUserId: scope.userId,
        defaultModelId: sessionModel.modelId,
      });

      const threadId = session.thread.requireId();
      const threadTitle = title ?? titleFrom(prompt);
      await session.thread.rename({ title: threadTitle, pin: false });
      // On the row too, so its run-end reports name it without waiting for the title mirror.
      await sourceControl.sessions.rename({ sessionId: ensured.sessionId, title: threadTitle });
      await session.thread.setSetting({ key: 'factorySessionId', value: ensured.sessionId });

      await primeTenantCredentialsForTenant({
        orgId: scope.orgId,
        userId: scope.userId,
        credentialScope: sessionModel.modelScope,
      });
      // How its runs end reaches this session through the listener every Factory
      // session gets (`observeSessionRunReports`), which follows the row's origin.
      // `requireDelivery` makes `accepted` reject when the wake fails; the run itself is not awaited.
      await session.sendSignal(
        { id: globalThis.crypto.randomUUID(), type: 'user', tagName: 'user', contents: prompt },
        { requestContext: kickoffContext, requireDelivery: true },
      ).accepted;

      return { mode: 'side' as const, sessionId: ensured.sessionId, threadId, title: threadTitle };
    },
  });

  async function startWorkItemRole({
    prompt,
    title,
    workItem,
    role,
  }: {
    prompt: string;
    title?: string;
    workItem: string;
    role?: string;
  }) {
    if (!role) throw new Error('Pass the role to start on the work item.');
    const coordinator = deps.startCoordinator();
    if (!coordinator) throw new Error("Factory sessions can't be started yet; try again shortly.");
    const item = await findWorkItem(deps.workItems, scope, workItem);
    if (!item) throw workItemNotFound(workItem);
    const label = workItemLabel(item);
    const board = deps.boards.get(boardForWorkItem(item));
    if (!board?.phaseForRole(role)) throw new Error(`${label}'s board has no ${role} role.`);
    const seated = item.sessions[role];
    if (seated) {
      throw new Error(
        `${label} already has a ${role} session ${seated.sessionId}; message it with factory_signal_session.`,
      );
    }

    const parent = await deps.sessions.getBySessionId(scope.sessionId);
    const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
    if (!parent || !sourceControl) throw new Error('This session has no Factory session row to start from.');
    const messaging = await deps.messaging();
    if (!messaging) throw new Error('Starting sessions is not available on this server.');
    const project = await deps.sessionModel.projects.get({ orgId: scope.orgId, id: scope.factoryProjectId });
    if (!project) throw new Error('This Factory no longer exists.');
    // A work-item start is a run, so a hybrid Factory uses the Factory's scope (as the Start route does).
    const modelScope = effectiveModelScope(project.modelScope, 'run');
    const projectRepositoryId = await resolveRepository(sourceControl, item);

    const sessionId = globalThis.crypto.randomUUID();
    const ensured = await ensureFactorySourceSession({
      sourceControl,
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      sessionId,
      branch: `${USER_SESSION_BRANCH_PREFIX}${sessionId}`,
      projectRepositoryId,
      attributeToUserId: scope.userId,
      visibility: parent.visibility,
    });

    // Follow first, so a fast run's first report already has somewhere to go.
    const followScope = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
    const alreadyFollowing = (
      await deps.workItems.listSessionSubscriptions({ ...followScope, sessionId: scope.sessionId })
    ).some(subscription => subscription.workItemId === item.id);
    await deps.workItems.subscribeToWorkItem({
      ...followScope,
      workItemId: item.id,
      sessionId: scope.sessionId,
      threadId: scope.threadId,
      resourceId: scope.resourceId,
      userId: scope.userId,
      reason: 'started',
    });

    const startedAt = new Date();
    let prepared;
    try {
      prepared = await coordinator.prepare({
        orgId: scope.orgId,
        userId: scope.userId,
        factoryProjectId: scope.factoryProjectId,
        sessionId: ensured.sessionId,
        threadTitle: title ?? `${label} ${role}`,
        kickoffKey: globalThis.crypto.randomUUID(),
        modelScope,
        defaultModelId: modelScope === 'factory' ? (project.defaultModelId ?? undefined) : undefined,
        workItem: {
          id: item.id,
          role,
          input: {
            externalSource: item.externalSource,
            parentWorkItemId: item.parentWorkItemId,
            title: item.title,
            stages: item.stages,
            sessions: item.sessions,
            metadata: item.metadata,
          },
        },
      });
    } catch (error) {
      if (!alreadyFollowing) {
        await deps.workItems.unsubscribeFromWorkItem({
          orgId: scope.orgId,
          workItemId: item.id,
          sessionId: scope.sessionId,
        });
      }
      const message = startErrorMessage(error);
      if (message) throw new Error(message);
      throw error;
    }

    const bindings = await deps.workItems.listRunBindings(scope.orgId, scope.factoryProjectId, item.id);
    const replaced = bindings.find(
      binding =>
        binding.role === role &&
        binding.id !== prepared.bindingId &&
        binding.revokedAt !== null &&
        binding.revokedAt >= startedAt,
    );

    const session = await messaging.controller.getSessionByResource(prepared.resourceId);
    if (!session) throw new Error(`The ${role} session was bound but is not running; open it from the board.`);
    const kickoffId = globalThis.crypto.randomUUID();
    // Heartbeat from before the kickoff so a fast run's end is seen; the open-run
    // entry and audit follow the accepted kickoff, as the dispatcher records them.
    // The run's end reaches this item's followers through the session's listener.
    const heartbeat = heartbeatOpenRunUntilEnd(session, kickoffId);
    const kickoffContext = new RequestContext();
    kickoffContext.set('user', { workosId: scope.userId, organizationId: scope.orgId });
    try {
      await session.sendSignal(
        { id: kickoffId, type: 'user', tagName: 'user', contents: prompt },
        { requestContext: kickoffContext, requireDelivery: true },
      ).accepted;
    } catch (error) {
      heartbeat.stop();
      throw error;
    }

    await recordSessionRunStart(session, {
      audit: deps.auditRecorder,
      actorType: 'human',
      observedEnd: heartbeat.endReason,
      run: {
        kickoffId,
        ownerId: FACTORY_TOOLS_OWNER_ID,
        heartbeatAt: Date.now(),
        bindingId: prepared.bindingId,
        role,
        startedBy: scope.userId,
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        workItemId: item.id,
        workItemName: item.title,
        sessionId: prepared.sessionId,
        threadId: prepared.threadId,
        branch: prepared.branch,
      },
    });

    const number = workItemNumber(item);
    return {
      mode: 'work-item' as const,
      workItem: { id: item.id, ...(number === null ? {} : { number }) },
      role,
      sessionId: prepared.sessionId,
      threadId: prepared.threadId,
      bindingId: prepared.bindingId,
      ...(replaced ? { replacedSessionId: replaced.sessionId } : {}),
    };
  }

  async function resolveRepository(sourceControl: SourceControlStorageHandle, item: WorkItemRow): Promise<string> {
    const intakeConfig = await deps.intake?.getConfig({ orgId: scope.orgId, integrationIds: ['linear'] });
    const repository = await resolveWorkItemRepository({
      sourceControl,
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      item,
      linearRepositoryMap: intakeConfig?.linear?.repositoryByLinearProject,
    });
    if (repository.status === 'ambiguous') {
      throw new Error(ambiguousRepository(repository.candidates));
    }
    if (repository.status === 'unlinked') throw new Error(repository.hint);
    return repository.projectRepositoryId;
  }

  return { factory_start_session: start };
}
