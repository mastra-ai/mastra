import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { factorySessionUrl } from '../links.js';
import { buildModelCatalog, listSessionScopedCredentials } from '../routes/config.js';
import { customEndpointUrlProblem } from '../routes/custom-endpoint-url.js';
import { customProviderOwner } from '../routes/custom-provider-source.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import { resolveFactoryModelPolicy } from '../session/credential-policy.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactorySessionModel,
} from '../session/factory-session.js';
import type { ModelCredentialsStorage } from '../storage/domains/credentials/base.js';
import type { CustomProvidersStorage } from '../storage/domains/custom-providers/base.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { USER_SESSION_BRANCH_PREFIX } from '../work-item-branch.js';
import { resolveSessionThread } from './deliver.js';
import type { FactoryMessaging } from './messaging-tools.js';
import type { FactoryToolScope } from './scope.js';
import { sessionModel } from './side-sessions.js';

const TITLE_LENGTH = 120;

export interface FactorySessionToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'getSourceControlBySessionId'>;
  sessionModel: {
    projects: FactoryProjectsStorage;
    modelDefaults: ModelDefaultsStorage;
    /**
     * The server's own sign-ins, for local mode without tenant credentials, so
     * model switches see the same catalog as the Settings picker.
     */
    localAuthStorage?: () => AuthStorage | undefined;
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
}

const LISTED_MODELS = 8;

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
      const usable = (await buildModelCatalog({ controller, authStorage: deps.sessionModel.localAuthStorage?.() })).map(
        model => model.id,
      );
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
    // The list model resolution uses for this session, so the tool never
    // offers a custom model the session cannot run. A tenant catalog only
    // exists with sign-in on.
    const customProviderOwnerForSession = customProviderOwner(
      { orgId, userId: policy.tenant.userId, credentialScope: modelScope },
      /* authEnabled */ true,
    );
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
        listCustomProviders:
          customProviders && customProviderOwnerForSession
            ? async () => {
                await customProviders.ensureReady();
                return (await customProviders.list(customProviderOwnerForSession)).filter(
                  provider => !customEndpointUrlProblem(provider.url),
                );
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
      'Use it when the person asks for a side session, and for work no card stage does: investigations and research, experiments, pushing fixes to an existing pull request or taking one over, or work that should leave the board alone.',
      "When someone asks for a card's own stage work without saying where, run it on the card instead, as the board's buttons do: \"review this pull request\" moves the pull request's card to its review stage or reruns it there, so the review is recorded on the card and posted on the pull request, and new work that should land as a pull request goes on its issue's card, or a card filed for it and started.",
      'Find cards with factory_list_work_items (a pasted link works) and move them, or rerun their stage, with factory_transition_work_item.',
      'Once a person in this conversation asks for a side session, or says not to use cards or the board, that holds for the rest of the conversation: run their later requests in side sessions too until they ask for a card. Work that follows from a side session, such as acting on what it found or fixing its pull request, goes back to that side session with factory_signal_session, unless they ask for a card for it.',
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
      })
      .strict(),
    execute: async ({ prompt, title, model }) => {
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

  return { factory_start_session: start, factory_switch_session_model: switchModel };
}
