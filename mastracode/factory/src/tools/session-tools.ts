import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { USER_SESSION_BRANCH_PREFIX } from '../routes/source-control-sessions.js';
import { primeTenantCredentialsForTenant } from '../routes/tenant-credentials.js';
import type { SourceControlSessionLookup } from '../session/factory-session.js';
import {
  ensureFactorySourceSession,
  hydrateFactorySession,
  resolveFactorySessionModel,
} from '../session/factory-session.js';
import type { ModelDefaultsStorage } from '../storage/domains/model-defaults/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { FactoryMessaging } from './messaging-tools.js';
import type { FactoryToolScope } from './scope.js';

const TITLE_LENGTH = 120;

export interface FactorySessionToolDependencies {
  sessions: Pick<SourceControlSessionLookup, 'getBySessionId' | 'getSourceControlBySessionId'>;
  sessionModel: { projects: FactoryProjectsStorage; modelDefaults: ModelDefaultsStorage };
  /** Resolved lazily: the controller only exists once the mount is up. */
  messaging: () => Promise<FactoryMessaging | null>;
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
    ].join(' '),
    inputSchema: z
      .object({
        prompt: z.string().trim().min(1).max(8000).describe('The first message the new session receives.'),
        title: z.string().trim().min(1).max(TITLE_LENGTH).optional(),
        workItem: z.string().trim().min(1).max(64).optional(),
        role: z.string().trim().min(1).max(64).optional(),
      })
      .strict()
      .refine(input => input.role === undefined || input.workItem !== undefined, {
        message: 'Pass workItem together with role.',
        path: ['role'],
      }),
    execute: async ({ prompt, title, workItem }) => {
      if (workItem !== undefined) throw new Error('Starting a role on a work item is not available yet.');

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
      // `requireDelivery` makes `accepted` reject when the wake fails; the run itself is not awaited.
      await session.sendSignal(
        { id: globalThis.crypto.randomUUID(), type: 'user', tagName: 'user', contents: prompt },
        { requestContext: kickoffContext, requireDelivery: true },
      ).accepted;

      return { mode: 'side' as const, sessionId: ensured.sessionId, threadId, title: threadTitle };
    },
  });

  return { factory_start_session: start };
}
