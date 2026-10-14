import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem } from '../boards/index.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { IntegrationTools } from '../integrations/base.js';
import { USER_SESSION_BRANCH_PREFIX } from '../routes/source-control-sessions.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import {
  FactoryStartTransitionError,
  WorkItemRepositoryError,
  type FactoryStartCoordinator,
} from '../rules/start-coordinator.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactorySessionModel,
} from '../session/factory-session.js';
import {
  FACTORY_OPEN_RUN_STALE_MS,
  heartbeatSessionOpenRun,
  recordSessionRunStart,
  type RunEndCaptureSession,
} from '../session/run-audit.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { deliverFactorySessionNotification } from './deliver.js';
import type { FactoryMessaging } from './messaging-tools.js';
import { findWorkItem, workItemNotFound, workItemNumber, workItemRefSchema } from './read-tools.js';
import { createWorkItemRunEndReporter, sendRunEndReport } from './reports.js';
import type { FactoryReporting, FactoryRunOutcome } from './reports.js';
import type { FactoryToolScope } from './scope.js';

const TITLE_LENGTH = 120;

/** Who renews the open-run entries this process writes; one id per process, like the dispatcher's. */
export const FACTORY_TOOLS_OWNER_ID = `factory-tools:${globalThis.crypto.randomUUID()}`;

type RunEndReason = Extract<AgentControllerEvent, { type: 'agent_end' }>['reason'];

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

/**
 * Renew this process's open-run entry while the run is live, and remember how
 * it ended. Stops at `agent_end` or `close()`, like the dispatcher's heartbeat.
 */
function watchStartedRun(
  session: RunEndCaptureSession,
  { kickoffId, onEnd }: { kickoffId?: string; onEnd: (outcome: FactoryRunOutcome) => Promise<void> },
) {
  let endReason: RunEndReason | undefined;
  let parked: { toolName: string; toolCallId: string } | undefined;
  const timer =
    kickoffId === undefined
      ? undefined
      : setInterval(() => void heartbeatSessionOpenRun(session, kickoffId), Math.floor(FACTORY_OPEN_RUN_STALE_MS / 3));
  timer?.unref?.();
  const close = () => {
    clearInterval(timer);
    unsubscribe();
  };
  const unsubscribe = session.subscribe(event => {
    if (event.type === 'tool_suspended') {
      parked = { toolName: event.toolName, toolCallId: event.toolCallId };
      return;
    }
    if (event.type === 'tool_suspension_cancelled' && parked?.toolCallId === event.toolCallId) {
      parked = undefined;
      return;
    }
    if (event.type !== 'agent_end') return;
    endReason = event.reason;
    close();
    void onEnd(runOutcome(event.reason, parked?.toolName));
  });
  return { endReason: () => endReason, close };
}

function runOutcome(reason: RunEndReason, parkedTool: string | undefined): FactoryRunOutcome {
  switch (reason) {
    case 'error':
      return { status: 'failed', reason: 'the run ended in error.' };
    case 'aborted':
      return { status: 'failed', reason: 'the run was aborted before it finished.' };
    case 'suspended':
      return { status: 'blocked', ...(parkedTool ? { toolName: parkedTool } : {}) };
    default:
      return { status: 'done' };
  }
}

function startErrorMessage(error: unknown): string | null {
  if (error instanceof WorkItemRepositoryError) {
    return error.code === 'repository_ambiguous'
      ? `This item has several repositories (${error.candidates.join(', ')}); v1 can't choose one.`
      : error.message;
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
        visibility: parent.visibility,
        origin: { sessionId: scope.sessionId, threadId: scope.threadId },
      });
      const sessionModel = await resolveFactorySessionModel({
        ...deps.sessionModel,
        factoryProjectId: scope.factoryProjectId,
        orgId: scope.orgId,
        ownerUserId: scope.userId,
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
      await session.thread.setSetting({ key: 'factorySessionId', value: ensured.sessionId });

      await primeTenantCredentialsForTenant({
        orgId: scope.orgId,
        userId: scope.userId,
        credentialScope: sessionModel.modelScope,
      });
      // The backstop: if the run ends without the agent's own final report, its origin still hears.
      const since = new Date();
      const sender = { sessionId: ensured.sessionId, threadId, userId: scope.userId };
      const watcher = watchStartedRun(session, {
        onEnd: async outcome => {
          try {
            const resolved = await reporting();
            if (!resolved) return;
            await sendRunEndReport(resolved, {
              sender,
              recipients: [{ sessionId: scope.sessionId, threadId: scope.threadId }],
              since,
              outcome,
              subject: `The side session "${threadTitle}"`,
            });
          } catch (error) {
            console.warn('[Factory reports] Unable to send the side session run-end report.', error);
          }
        },
      });
      // `requireDelivery` makes `accepted` reject when the wake fails; the run itself is not awaited.
      try {
        await session.sendSignal(
          { id: globalThis.crypto.randomUUID(), type: 'user', tagName: 'user', contents: prompt },
          { requestContext: kickoffContext, requireDelivery: true },
        ).accepted;
      } catch (error) {
        watcher.close();
        throw error;
      }

      return { mode: 'side' as const, sessionId: ensured.sessionId, threadId, title: threadTitle };
    },
  });

  async function reporting(): Promise<FactoryReporting | null> {
    const messaging = await deps.messaging();
    if (!messaging) return null;
    return {
      notifications: messaging.notifications,
      deliver: (target, notification) =>
        deliverFactorySessionNotification({
          controller: messaging.controller,
          sessions: deps.sessions,
          target,
          notification,
        }),
    };
  }
  const workItemRunEnd = createWorkItemRunEndReporter({ workItems: deps.workItems, reporting });

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
    const project_ = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
    const alreadyFollowing = (
      await deps.workItems.listSessionSubscriptions({ ...project_, sessionId: scope.sessionId })
    ).some(subscription => subscription.workItemId === item.id);
    await deps.workItems.subscribeToWorkItem({
      ...project_,
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
        modelScope: project.modelScope,
        defaultModelId: project.modelScope === 'factory' ? (project.defaultModelId ?? undefined) : undefined,
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
    // Watch before the kickoff so a fast run's end is not missed; the open-run
    // entry and audit follow the accepted kickoff, as the dispatcher records them.
    const since = new Date();
    const watcher = watchStartedRun(session, {
      kickoffId,
      onEnd: outcome =>
        workItemRunEnd({
          orgId: scope.orgId,
          factoryProjectId: scope.factoryProjectId,
          workItemId: item.id,
          role,
          sender: { sessionId: prepared.sessionId, threadId: prepared.threadId, userId: scope.userId },
          since,
          outcome,
        }),
    });
    const kickoffContext = new RequestContext();
    kickoffContext.set('user', { workosId: scope.userId, organizationId: scope.orgId });
    try {
      await session.sendSignal(
        { id: kickoffId, type: 'user', tagName: 'user', contents: prompt },
        { requestContext: kickoffContext, requireDelivery: true },
      ).accepted;
    } catch (error) {
      watcher.close();
      throw error;
    }

    await recordSessionRunStart(session, {
      audit: deps.auditRecorder,
      actorType: 'human',
      observedEnd: watcher.endReason,
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
      throw new Error(`This item has several repositories (${repository.candidates.join(', ')}); v1 can't choose one.`);
    }
    if (repository.status === 'unlinked') throw new Error(repository.hint);
    return repository.projectRepositoryId;
  }

  return { factory_start_session: start };
}
