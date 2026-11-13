import type { NotificationRecord } from '@mastra/core/notifications';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem } from '../boards/index.js';
import { workLaneForRole } from '../boards/legacy-plan-role.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { BoardRegistry } from '../boards/registry.js';
import type { IntegrationTools } from '../integrations/base.js';
import { factorySessionUrl, factoryWorkItemUrl } from '../links.js';
import { buildModelCatalog, listSessionScopedCredentials } from '../routes/config.js';
import { USER_SESSION_BRANCH_PREFIX } from '../routes/source-control-sessions.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { FactoryStartTransitionError, WorkItemRepositoryError } from '../rules/start-coordinator.js';
import type { FactoryStartCoordinator } from '../rules/start-coordinator.js';
import { resolveFactoryModelPolicy } from '../session/credential-policy.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  requireOrganizationModelKey,
  resolveFactorySessionModel,
} from '../session/factory-session.js';
import { recordSessionRunStart } from '../session/run-audit.js';
import { resolveWorkItemRepository } from '../session/work-item-repository.js';
import type { AuditRecorder } from '../storage/domains/audit/domain.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type { IntakeStorage } from '../storage/domains/intake/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import { effectiveModelScope, factoryPrincipalId } from '../storage/domains/projects/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { workItemNumber } from '../work-items/card-number.js';
import { deliverFactorySessionNotification, resolveSessionThread } from './deliver.js';
import type { FactoryMessaging } from './messaging-tools.js';
import { findWorkItem, workItemNotFound, workItemRefSchema } from './read-tools.js';
import { heartbeatOpenRunUntilEnd } from './run-watch.js';
import type { FactoryToolScope } from './scope.js';
import { listSessionNotifications, newestNotification, sessionModel } from './side-sessions.js';

const TITLE_LENGTH = 120;

/** Who renews the open-run entries this process writes; one id per process, like the dispatcher's. */
export const FACTORY_TOOLS_OWNER_ID = `factory-tools:${globalThis.crypto.randomUUID()}`;

export interface FactorySessionToolDependencies {
  sessions: Pick<
    SourceControlSessionLookup,
    'getBySessionId' | 'getSourceControlBySessionId' | 'listByOrigin' | 'approveFollowUp' | 'setFollowUpUsed'
  >;
  sessionModel: {
    projects: FactoryProjectsStorage;
    modelDefaults: ModelDefaultsStorage;
    /**
     * Tenant credential stores, present when auth is on. Model switches then
     * check the target session's credential scope, like the Settings picker;
     * without them the server's own keys decide.
     */
    tenantCatalog?: {
      credentials: Pick<ModelCredentialsStorage, 'listCredentials'>;
      customProviders?: Pick<CustomProvidersStorage, 'ensureReady' | 'list'>;
      deploymentProviders?: ReadonlySet<string>;
    };
  };
  /** Resolved lazily: the controller only exists once the mount is up. */
  messaging: () => Promise<FactoryMessaging | null>;
  workItems: Pick<
    WorkItemsStorage,
    | 'listShared'
    | 'getForProject'
    | 'listRunBindings'
    | 'findActiveRunBindingForSession'
    | 'findRunBindingByThread'
    | 'hasRunBindingForSession'
    | 'subscribeToWorkItem'
    | 'unsubscribeFromWorkItem'
    | 'listSessionSubscriptions'
    | 'listWorkItemSubscribers'
  >;
  /** A fixed registry, or the per-project boards. */
  boards: BoardRegistry | ProjectBoardSource;
  auditRecorder: AuditRecorder;
  intake?: Pick<IntakeStorage, 'getConfig'>;
  /** The browser Start's coordinator; absent until the Factory runtime is ready. */
  startCoordinator: () => Pick<FactoryStartCoordinator, 'prepare'> | undefined;
}

const LISTED_MODELS = 8;

/** How long a person's approval of follow-up work waits for the side session to report. */
export const FOLLOW_UP_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * How long after the side session's handoff report its approval can start a role. The turn that report woke
 * files the card and starts it right away; a later turn (a schedule, a webhook) shouldn't inherit the approval.
 */
export const FOLLOW_UP_HANDOFF_WINDOW_MS = 30 * 60 * 1000;

/** Notifications read on the thread to check that nothing woke it after the handoff report. */
export const FOLLOW_UP_NOTIFICATION_SCAN = 100;

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

function workItemLabel(item: Card): string {
  const number = workItemNumber(item);
  return number === null ? `"${item.title}"` : `#${number}`;
}

/** Why a role start without a person was refused, and what to tell them: the card is filed but has no run. */
function notStartedError(label: string, reason: string): string {
  return [
    `${label} is filed but nothing was started on it: nobody signed in started this turn, and ${reason}.`,
    `Tell the person the card is waiting, link it, and ask them to say "start" on it in their chat; don't report the work as started.`,
  ].join(' ');
}

/** A side session's handoff: a plain report or a `done`, not a progress, blocked or failed update. */
function isHandoffReport(record: Pick<NotificationRecord, 'kind' | 'attributes'>): boolean {
  if (record.kind === 'report' || record.kind === 'done') return true;
  return record.kind === 'reply' && record.attributes?.status === 'done';
}

function titleFrom(prompt: string): string {
  const firstLine = prompt.split('\n').find(line => line.trim()) ?? prompt;
  return firstLine.trim().slice(0, TITLE_LENGTH);
}

/** Tools that start sessions on the caller's behalf, or switch their models. User sessions only. */
export function createFactorySessionTools(
  scope: FactoryToolScope,
  deps: FactorySessionToolDependencies,
): IntegrationTools {
  /** The models a session can switch to, resolved from the target session's owner and project policy. */
  async function sessionModelCatalog(
    controller: FactoryMessaging['controller'],
    sessionId: string,
    threadId: string,
    resourceId: string,
  ): Promise<{ usable: string[]; known: Set<string>; scopeLabel: string }> {
    const models = await controller.listAvailableModels();
    const known = new Set(models.flatMap(model => (typeof model.id === 'string' ? [model.id] : [])));
    const tenantCatalog = deps.sessionModel.tenantCatalog;
    if (!tenantCatalog) {
      const usable = (await buildModelCatalog({ controller })).map(model => model.id);
      return { usable, known, scopeLabel: 'server' };
    }
    const requestContext = new RequestContext();
    requestContext.set('user', { id: scope.userId, organizationId: scope.orgId });
    requestContext.set('controller', { sessionId, resourceId, threadId });
    const policy = await resolveFactoryModelPolicy(requestContext, {
      projects: deps.sessionModel.projects,
      sourceControl: deps.sessions,
      workItems: deps.workItems,
    });
    if (!policy) throw new Error('Session model policy is unavailable.');
    const modelScope = policy.tenant.credentialScope ?? 'user';
    const orgId = policy.tenant.orgId ?? scope.orgId;
    const customProviders = tenantCatalog.customProviders;
    const usable = (
      await buildModelCatalog({
        controller,
        tenantCredentials: await listSessionScopedCredentials({
          credentials: tenantCatalog.credentials,
          orgId,
          userId: policy.tenant.userId,
          modelScope,
        }),
        deploymentProviders: tenantCatalog.deploymentProviders,
        listCustomProviders: customProviders
          ? async () => {
              await customProviders.ensureReady();
              return customProviders.list({ orgId });
            }
          : undefined,
      })
    ).map(model => model.id);
    for (const id of usable) known.add(id);
    return { usable, known, scopeLabel: modelScope === 'factory' ? 'Factory' : 'session owner' };
  }

  function unrunnableModelError(
    modelId: string,
    catalog: { usable: string[]; known: Set<string>; scopeLabel: string },
  ) {
    const options = catalog.usable.length
      ? ` Models available to it: ${catalog.usable.slice(0, LISTED_MODELS).join(', ')}${catalog.usable.length > LISTED_MODELS ? ', …' : ''}.`
      : ' No models are available to it; connect a provider credential first.';
    return new Error(
      catalog.known.has(modelId)
        ? `Model ${modelId} exists, but this session's credential scope (${catalog.scopeLabel}) has no credential for its provider.${options}`
        : `Unknown model ${modelId}.${options}`,
    );
  }

  const switchModel = createTool({
    id: 'factory_switch_session_model',
    description:
      'Look up or switch the model of a session you own in this Factory (side, work item, or review session). When someone describes a model by purpose, family, or preference rather than an exact ID, call with sessionId alone first to list models the target session can actually use. Interpret their intent against that list, then call with the chosen exact modelId to switch; do not use their words as a guessed model ID. A running session switches immediately; a stopped one uses the model on its next run. User-scoped sessions use their owner credentials; Factory-scoped sessions use Factory credentials. Use a session ID from the Factory session or work item tools.',
    inputSchema: z
      .object({
        sessionId: z.string().trim().min(1).max(200),
        modelId: z.string().trim().min(1).max(200).optional().describe('Omit to list usable models without switching.'),
      })
      .strict(),
    execute: async ({ sessionId, modelId }) => {
      const row = await deps.sessions.getBySessionId(sessionId);
      if (
        !row ||
        row.orgId !== scope.orgId ||
        row.factoryProjectId !== scope.factoryProjectId ||
        row.userId !== scope.userId
      ) {
        throw new Error('Session not found or not owned by you in this Factory.');
      }
      // A turn nobody signed in started reaches only this session and the side sessions it started.
      if (!scope.interactive && sessionId !== scope.sessionId && row.originSessionId !== scope.sessionId) {
        throw new Error(
          'Without a person in this turn, only this session and the side sessions it started can switch models.',
        );
      }
      const messaging = await deps.messaging();
      if (!messaging) throw new Error('Session model switching is not available on this server.');
      const threadId = await resolveSessionThread({
        controller: messaging.controller,
        sessions: deps.sessions,
        workItems: deps.workItems,
        sessionId,
      });
      if (!threadId) throw new Error('Session has no conversation thread yet.');
      // The thread's resource, not the session id: sessions share their Factory's or owner's resource.
      const resourceId = (await messaging.controller.queryThreadById({ threadId }))?.resourceId ?? sessionId;
      const catalog = await sessionModelCatalog(messaging.controller, sessionId, threadId, resourceId);
      if (modelId === undefined) return { sessionId, models: catalog.usable };
      if (!catalog.usable.includes(modelId)) throw unrunnableModelError(modelId, catalog);
      const { live } = await messaging.controller.setThreadModel({ resourceId, threadId, modelId });
      return { sessionId, threadId, modelId, live };
    },
  });

  const start = createTool({
    id: 'factory_start_session',
    description: [
      'Start a side session in this Factory with a prompt. It runs on its own sandbox and branch as you, and reports back to this session with `factory-session` notifications.',
      'A side session uses this session’s model. Pass `model` to start it on another model the session credentials can run.',
      'Use it for self-contained investigations; when the result should land as a pull request, file a work item instead.',
      'With `workItem` and `role` it starts that role on the work item instead, without moving the card, and this session follows the item.',
      "A role that already has a session on the item (current or past) can't be started again from here: message that session with factory_signal_session, or ask the person to start it from a signed-in chat.",
      'Starting a role records a run as the person, so it needs a turn the person started, or their approval given ahead: when the person asks for work that a side session should look into first, start that side session with `approvedFollowUp: true`.',
      'In the turn its final report (done) wakes, within 30 minutes, this session may file one work item and start one role on it without asking the person again. Any other notification reaching this session after the report, a later turn, or a card filed before the report ends that: ask the person instead.',
    ].join(' '),
    inputSchema: z
      .object({
        prompt: z.string().trim().min(1).max(8000).describe('The first message the new session receives.'),
        title: z.string().trim().min(1).max(TITLE_LENGTH).optional(),
        model: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            'Model id for a side session. Omit it to inherit this session’s model. The session credentials must be able to run it.',
          ),
        workItem: workItemRefSchema.optional(),
        role: z.string().trim().min(1).max(64).optional(),
        approvedFollowUp: z
          .boolean()
          .optional()
          .describe(
            'Side sessions only. True when the person in this turn already asked for the work this side session leads to, so that when it reports you may file one work item and start one role on it without asking again. Only in a turn the person started.',
          ),
      })
      .strict()
      .refine(input => input.role === undefined || input.workItem !== undefined, {
        message: 'Pass workItem together with role.',
        path: ['role'],
      })
      .refine(input => input.approvedFollowUp === undefined || input.workItem === undefined, {
        message: 'approvedFollowUp is for side sessions; leave it out with workItem.',
        path: ['approvedFollowUp'],
      }),
    execute: async ({ prompt, title, model, workItem, role, approvedFollowUp }) => {
      if (workItem !== undefined) {
        // A role start records a run as the person, so it waits for a turn the person started,
        // or uses the approval they gave ahead for a side session this one started.
        if (scope.interactive) return startWorkItemRole({ prompt, title, workItem, role });
        const item = await findWorkItem(deps.workItems, scope, workItem);
        if (!item) throw workItemNotFound(workItem);
        const grantSessionId = await followUpGrantFor(item);
        return startWorkItemRole({ prompt, title, workItem, role, grantSessionId });
      }
      if (approvedFollowUp && !scope.interactive) {
        throw new Error(
          'Only the person can approve follow-up work, and nobody signed in started this turn; leave approvedFollowUp out.',
        );
      }

      const parent = await deps.sessions.getBySessionId(scope.sessionId);
      const sourceControl = await deps.sessions.getSourceControlBySessionId(scope.sessionId);
      if (!parent || !sourceControl) throw new Error('This session has no Factory session row to start from.');
      const messaging = await deps.messaging();
      if (!messaging) throw new Error('Starting sessions is not available on this server.');

      // The child runs with the same credentials as this session, so validate against those.
      const parentThreadId = await resolveSessionThread({
        controller: messaging.controller,
        sessions: deps.sessions,
        workItems: deps.workItems,
        sessionId: scope.sessionId,
      });
      const parentResourceId = parentThreadId
        ? ((await messaging.controller.queryThreadById({ threadId: parentThreadId }))?.resourceId ?? scope.sessionId)
        : scope.sessionId;
      const catalog = await sessionModelCatalog(
        messaging.controller,
        scope.sessionId,
        parentThreadId ?? scope.threadId,
        parentResourceId,
      );
      const inherited = model
        ? null
        : await sessionModel(messaging.controller, deps.sessions, deps.workItems, scope.sessionId);
      const requestedModel = model ?? (inherited && catalog.usable.includes(inherited) ? inherited : undefined);
      if (requestedModel && !catalog.usable.includes(requestedModel))
        throw unrunnableModelError(requestedModel, catalog);

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
      if (approvedFollowUp) await deps.sessions.approveFollowUp({ sessionId: ensured.sessionId, userId: scope.userId });
      const resolvedModel = await resolveFactorySessionModel({
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
        // A side session works for the Factory, so it shares the Factory's memory
        // resource; a private one stays with its owner, like a Slack DM.
        resourceId: parent.visibility === 'private' ? scope.userId : scope.factoryProjectId,
        threadId: ensured.sessionId,
        requestContext: kickoffContext,
        tags,
      });
      await session.state.set(tags);
      await hydrateFactorySession(session, {
        orgId: scope.orgId,
        modelScope: resolvedModel.modelScope,
        ownerUserId: scope.userId,
        defaultModelId: requestedModel ?? resolvedModel.modelId,
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
        credentialScope: resolvedModel.modelScope,
      });
      // How its runs end reaches this session through the listener every Factory
      // session gets (`observeSessionRunReports`), which follows the row's origin.
      // `requireDelivery` makes `accepted` reject when the wake fails; the run itself is not awaited.
      await session.sendSignal(
        { id: globalThis.crypto.randomUUID(), type: 'user', tagName: 'user', contents: prompt },
        { requestContext: kickoffContext, requireDelivery: true },
      ).accepted;

      return {
        mode: 'side' as const,
        sessionId: ensured.sessionId,
        threadId,
        title: threadTitle,
        url:
          factorySessionUrl({ factoryProjectId: scope.factoryProjectId, sessionId: ensured.sessionId, threadId }) ??
          null,
      };
    },
  });

  async function startWorkItemRole({
    prompt,
    title,
    workItem,
    role,
    grantSessionId,
  }: {
    prompt: string;
    title?: string;
    workItem: string;
    role?: string;
    /** The side session whose follow-up approval this start uses, when no person started the turn. */
    grantSessionId?: string;
  }) {
    if (!role) throw new Error('Pass the role to start on the work item.');
    const coordinator = deps.startCoordinator();
    if (!coordinator) throw new Error("Factory sessions can't be started yet; try again shortly.");
    const item = await findWorkItem(deps.workItems, scope, workItem);
    if (!item) throw workItemNotFound(workItem);
    const label = workItemLabel(item);
    const board = (await toBoardSource(deps.boards).load(scope)).get(boardForWorkItem(item));
    // Work's old `plan` role still names Planning, though no phase runs in a `plan` context any more.
    if (!workLaneForRole(board, role) && !board?.phaseForRole(role)) {
      throw new Error(`${label}'s board has no ${role} role.`);
    }
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
    // On the Factory's credentials the card's session is the Factory's own, as when the board starts it;
    // the person asking stays the one who started it, and follows it from this session.
    const ownerUserId = modelScope === 'factory' ? factoryPrincipalId(project.id) : scope.userId;
    if (modelScope === 'factory') {
      await requireOrganizationModelKey(
        {
          modelCredentials: deps.sessionModel.tenantCatalog?.credentials,
          customProviders: deps.sessionModel.tenantCatalog?.customProviders,
          deploymentModelProviders: deps.sessionModel.tenantCatalog?.deploymentProviders,
        },
        project,
      );
    }
    const projectRepositoryId = await resolveRepository(sourceControl, item);

    const sessionId = globalThis.crypto.randomUUID();
    const ensured = await ensureFactorySourceSession({
      sourceControl,
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      sessionId,
      branch: `${USER_SESSION_BRANCH_PREFIX}${sessionId}`,
      projectRepositoryId,
      attributeToUserId: ownerUserId,
      // A run works a shared card, so the org can open it and answer its approvals even when the session that
      // started it is private.
      visibility: 'org',
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

    // Used after every check, so a refused start leaves the approval for a corrected one.
    if (grantSessionId && !(await deps.sessions.setFollowUpUsed({ sessionId: grantSessionId, used: true }))) {
      if (!alreadyFollowing) {
        await deps.workItems.unsubscribeFromWorkItem({
          orgId: scope.orgId,
          workItemId: item.id,
          sessionId: scope.sessionId,
        });
      }
      throw new Error(notStartedError(label, 'its approval was just used by another start'));
    }
    const startedAt = new Date();
    let prepared;
    try {
      prepared = await coordinator.prepare({
        orgId: scope.orgId,
        userId: ownerUserId,
        startedBy: { type: 'human', id: scope.userId },
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
      if (grantSessionId) await deps.sessions.setFollowUpUsed({ sessionId: grantSessionId, used: false });
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

    const session = await messaging.controller.getSession(prepared.sessionId);
    if (!session) {
      throw new Error(
        `The ${role} session ${prepared.sessionId} was bound but is not running; message it with factory_signal_session to wake it.`,
      );
    }
    const kickoffId = globalThis.crypto.randomUUID();
    // Heartbeat from before the kickoff so a fast run's end is seen; the open-run
    // entry and audit follow the accepted kickoff, as the dispatcher records them.
    // The run's end reaches this item's followers through the session's listener.
    const heartbeat = heartbeatOpenRunUntilEnd(session, kickoffId);
    const kickoffContext = new RequestContext();
    kickoffContext.set('user', { workosId: ownerUserId, organizationId: scope.orgId });
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
      workItem: {
        id: item.id,
        ...(number === null ? {} : { number }),
        url:
          factoryWorkItemUrl({
            factoryProjectId: scope.factoryProjectId,
            board: boardForWorkItem(item),
            workItemId: item.id,
          }) ?? null,
      },
      role,
      sessionId: prepared.sessionId,
      threadId: prepared.threadId,
      url:
        factorySessionUrl({
          factoryProjectId: scope.factoryProjectId,
          sessionId: prepared.sessionId,
          threadId: prepared.threadId,
        }) ?? null,
      bindingId: prepared.bindingId,
      ...(replaced ? { replacedSessionId: replaced.sessionId } : {}),
    };
  }

  /**
   * The side session whose unused follow-up approval covers a role start on `item` in a turn nobody signed in
   * started: approved by this caller within the TTL, with `item` filed by this session after that side session reported.
   * The start must run in the turn that report woke: nothing else may have reached the thread since the report
   * (a webhook, a peer's signal, a rule notice all arrive as notifications), and the report must be recent.
   */
  async function followUpGrantFor(item: Card): Promise<string> {
    const label = workItemLabel(item);
    const approved = (
      await deps.sessions.listByOrigin({ orgId: scope.orgId, originSessionId: scope.sessionId })
    ).flatMap(row =>
      row.factoryProjectId === scope.factoryProjectId &&
      row.followUpApprovedAt &&
      row.followUpApprovedBy === scope.userId
        ? [{ sessionId: row.sessionId, approvedAt: row.followUpApprovedAt, usedAt: row.followUpUsedAt }]
        : [],
    );
    if (approved.length === 0) {
      throw new Error(notStartedError(label, 'the person approved no follow-up work for a side session of this one'));
    }
    const filed = (
      await deps.workItems.listSessionSubscriptions({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        sessionId: scope.sessionId,
      })
    ).find(subscription => subscription.workItemId === item.id && subscription.reason === 'created');
    // Order against the card's own filing time; the subscription is written after it and only attributes the card.
    const after = filed ? approved.filter(grant => item.createdAt >= grant.approvedAt) : [];
    if (after.length === 0) {
      throw new Error(
        notStartedError(
          label,
          "this session didn't file it after the person approved follow-up work, so that approval doesn't cover it",
        ),
      );
    }
    // The approval covers the work the side session's report leads to: the report must land between the
    // approval and the filing, so a card filed on some other turn before the handoff can't spend it.
    const notifications = (await deps.messaging())?.notifications ?? null;
    const reports = await listSessionNotifications(notifications, scope.threadId);
    const handoffs = after.flatMap(grant => {
      const report = newestNotification(
        reports,
        record =>
          record.attributes?.['from-session'] === grant.sessionId &&
          isHandoffReport(record) &&
          record.createdAt >= grant.approvedAt &&
          record.createdAt <= item.createdAt,
      );
      return report ? [{ ...grant, report }] : [];
    });
    const covering = handoffs.filter(grant => !grant.usedAt);
    if (handoffs.length === 0) {
      throw new Error(
        notStartedError(
          label,
          "the approved side session hadn't reported back when this session filed it, so the approval doesn't cover it",
        ),
      );
    }
    if (covering.length === 0) throw new Error(notStartedError(label, 'its approval was already used to start a role'));
    const now = Date.now();
    const fresh = covering
      .filter(grant => now - grant.approvedAt.getTime() <= FOLLOW_UP_APPROVAL_TTL_MS)
      .sort((left, right) => right.report.createdAt.getTime() - left.report.createdAt.getTime());
    if (fresh.length === 0) throw new Error(notStartedError(label, 'its approval expired'));
    const latest = fresh.find(grant => now - grant.report.createdAt.getTime() <= FOLLOW_UP_HANDOFF_WINDOW_MS);
    if (!latest) {
      throw new Error(
        notStartedError(label, "the side session's report came too long ago for this turn to be the one it woke"),
      );
    }
    // Anything that reached the thread after the report woke a turn of its own, or will; that turn didn't come
    // from the report, and this one can't tell them apart, so the approval stays for the person. A record that
    // coalesced a later event keeps its first createdAt, so its updatedAt stands in for that event.
    const recent = notifications
      ? await notifications.listNotifications({ threadId: scope.threadId, limit: FOLLOW_UP_NOTIFICATION_SCAN })
      : [];
    const since = recent.find(
      record =>
        record.id !== latest.report.id &&
        (record.createdAt > latest.report.createdAt ||
          ((record.coalescedCount ?? 1) > 1 && record.updatedAt > latest.report.createdAt)),
    );
    // The list is newest-updated first and can't page, so a full scan that never reaches back to the report may
    // have cut off a later arrival; refuse rather than guess.
    if (
      !since &&
      recent.length >= FOLLOW_UP_NOTIFICATION_SCAN &&
      recent[recent.length - 1]!.updatedAt > latest.report.createdAt
    ) {
      throw new Error(
        notStartedError(
          label,
          "too many notifications reached this session after the side session's report to tell whether this turn is the one it woke",
        ),
      );
    }
    if (since) {
      throw new Error(
        notStartedError(
          label,
          `a ${since.source} notification reached this session after the side session's report, so this turn may not be the one the report woke`,
        ),
      );
    }
    return latest.sessionId;
  }

  async function resolveRepository(sourceControl: SourceControlStorageHandle, item: Card): Promise<string> {
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

  return { factory_start_session: start, factory_switch_session_model: switchModel };
}
