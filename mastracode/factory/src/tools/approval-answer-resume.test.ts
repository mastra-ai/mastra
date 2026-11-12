import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { LLMock } from '@copilotkit/aimock';
import { createMastraCode } from '@mastra/code-sdk';
import {
  resolveAuthenticatedCredentialTenant,
  setCredentialStoreProvider,
} from '@mastra/code-sdk/agents/credential-resolver';
import type { CredentialTenant } from '@mastra/code-sdk/agents/credential-resolver';
import { EventEmitterPubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { PostgresStore } from '@mastra/pg';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { buildSourceControlSessionRoutes } from '../routes/source-control-sessions.js';
import {
  registerTenantCredentialResolver,
  resetTenantCredentialResolverForTests,
} from '../routes/tenant-credentials.js';
import { fakeRouteAuth, mountApiRoutes } from '../routes/test-utils.js';
import { resolveFactoryCredentialTenant } from '../session/credential-policy.js';
import { factoryPrincipalId } from '../storage/domains/projects/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { createFactoryApprovalTools } from './approval-tools.js';
import type { FactoryToolScope } from './scope.js';

vi.setConfig({ testTimeout: 60_000 });

const ORG = 'org-1';
const OWNER = 'user-owner';
const REQUESTER = 'user-requester';
const STRANGER = 'user-stranger';
const MODEL = 'gpt-5.4-mini';
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

let directory: string;
let mock: LLMock;
let resolved: Array<CredentialTenant | undefined>;
let stops: Array<() => Promise<void> | void>;

beforeEach(async () => {
  directory = mkdtempSync(path.join(tmpdir(), 'factory-approval-answer-'));
  mock = new LLMock({ port: 0 });
  await mock.start();
  vi.stubEnv('OPENAI_BASE_URL', `${mock.url.replace(/\/+$/, '')}/v1`);
  vi.stubEnv('OPENAI_API_KEY', 'process-env-key-must-not-be-used');
  vi.stubEnv('MASTRA_APP_DATA_DIR', path.join(directory, 'app-data'));
  vi.stubEnv('MASTRACODE_DISABLE_UNIX_SOCKET_PUBSUB', '1');
  vi.stubEnv('MASTRACODE_DISABLE_OBSERVATIONAL_MEMORY', '1');
  resolved = [];
  stops = [];
  // Every model call resolves its credentials through here, as a Factory server's do.
  setCredentialStoreProvider(
    tenant => {
      const key = `key-for-${tenant.userId}`;
      return {
        allowEnvironmentFallback: false,
        reload: () => {},
        get: () => ({ type: 'api_key', key }),
        getStoredApiKey: () => key,
        getApiKey: async () => key,
      };
    },
    async requestContext => {
      const tenant = resolveAuthenticatedCredentialTenant(requestContext);
      resolved.push(tenant);
      return tenant;
    },
  );
});

afterEach(async () => {
  resetTenantCredentialResolverForTests();
  for (const stop of stops.splice(0).reverse()) await stop();
  await mock.stop();
  vi.unstubAllEnvs();
  rmSync(directory, { recursive: true, force: true });
});

async function sessionStorage(backend: string) {
  if (backend === 'libsql') {
    return new LibSQLStore({ id: 'approval-answer', url: `file:${path.join(directory, 'mastra.db')}` });
  }
  const schemaName = `approval_answer_${randomUUID().replaceAll('-', '')}`;
  const storage = new PostgresStore({ id: 'approval-answer', connectionString: postgresUrl!, schemaName });
  stops.push(async () => {
    // The resumed run can still be saving its last messages; Postgres aborts one side, so ask again.
    await vi.waitFor(() => storage.pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`), { timeout: 10_000 });
    await storage.close();
  });
  return storage;
}

/** What the phase session's run stops on, and the tool call that holds it. */
const PARKED = {
  /** The plan tool pauses itself and resumes on the answer. */
  plan: { toolCallId: 'call_plan', toolName: 'submit_plan' },
  /** A board's own tool that may not run until a person agrees. */
  release: { toolCallId: 'call_release', toolName: 'ship_release' },
  /** A question to the person: an answer, not a yes or no. */
  question: { toolCallId: 'call_question', toolName: 'ask_user' },
} as const;

/**
 * A card's phase session, owned by one person, stops on a tool call that waits for approval.
 * The person who asked for the work follows the card from their own session and answers there.
 */
describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'a tool call waiting for approval, answered from a session following the card (%s)',
  backend => {
    async function parkedPhaseSession(options?: { ownedByFactory?: boolean; parkedOn?: keyof typeof PARKED }) {
      const parkedOn = options?.parkedOn ?? 'plan';
      const parked = PARKED[parkedOn];
      const settingsPath = path.join(directory, 'settings.json');
      writeFileSync(
        settingsPath,
        JSON.stringify({
          onboarding: { skippedAt: '2026-01-01T00:00:00.000Z', version: 1 },
          models: { activeModelPackId: null, modeDefaults: { build: `openai/${MODEL}`, plan: `openai/${MODEL}` } },
        }),
      );
      const plansDir = path.join(directory, 'plans');
      mkdirSync(plansDir, { recursive: true });
      const planPath = path.join(plansDir, 'fix.md');
      writeFileSync(planPath, '# Fix\n\n1. Do it.\n');
      const toolArguments = {
        plan: { path: planPath },
        release: { version: '1.2.0' },
        question: { question: 'Which branch should this target?' },
      }[parkedOn];
      mock.on(
        { sequenceIndex: 0 },
        { toolCalls: [{ id: parked.toolCallId, name: parked.toolName, arguments: JSON.stringify(toolArguments) }] },
      );
      mock.onMessage(/.*/, { content: 'Carrying on.' });
      const shipped: string[] = [];

      const code = await createMastraCode({
        cwd: directory,
        homeDir: directory,
        configDir: '.mastracode-test',
        settingsPath,
        storage: await sessionStorage(backend),
        storageBackend: backend === 'libsql' ? 'libsql' : 'pg',
        pubsub: new EventEmitterPubSub(),
        disableMcp: true,
        disableHooks: true,
        disableEnvFile: true,
        disablePlugins: true,
        disableGithubSignals: true,
        createInitialThread: false,
        plansDir,
        // Tools run unasked by default; this session asks a person first, as a gated Factory tool does.
        ...(parkedOn === 'release' ? { initialState: { yolo: false } } : {}),
        extraTools: {
          ship_release: createTool({
            id: 'ship_release',
            description: 'Ship a release. A person approves each one.',
            inputSchema: z.object({ version: z.string() }),
            requireApproval: true,
            execute: async ({ version }) => {
              shipped.push(version);
              return { shipped: version };
            },
          }),
        },
      });
      stops.push(() => code.controller.shutdown?.());

      const seeded = await createFactoryStorageForTests();
      const sourceControl = seeded.sourceControl.forIntegration('github');
      const project = await seeded.projects.create({ orgId: ORG, userId: OWNER, input: { name: 'Mastra' } });
      const installation = await sourceControl.installations.upsert({
        orgId: ORG,
        connectedByUserId: OWNER,
        externalId: '123',
      });
      const repository = await sourceControl.repositories.upsert({
        orgId: ORG,
        input: { installationId: installation.id, externalId: '456', slug: 'mastra-ai/mastra', defaultBranch: 'main' },
      });
      const connection = await sourceControl.connections.create({
        orgId: ORG,
        factoryProjectId: project.id,
        installationId: installation.id,
        createdByUserId: OWNER,
      });
      const link = await sourceControl.projectRepositories.link({
        orgId: ORG,
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: OWNER,
        sandboxProvider: 'local',
        sandboxWorkdir: '/sandbox/mastra',
      });
      // A phase nobody started is the Factory's own; one a person started is theirs.
      const owner = options?.ownedByFactory ? factoryPrincipalId(project.id) : OWNER;
      if (options?.ownedByFactory) {
        // The Factory server's own wiring: who pays is read from the session row, and keys from storage.
        await seeded.credentials.setCredential({ orgId: ORG }, 'openai', { type: 'api_key', key: 'sk-organization' });
        registerTenantCredentialResolver(seeded.credentials, new Set(), async requestContext => {
          const tenant = await resolveFactoryCredentialTenant(requestContext, {
            projects: seeded.projects,
            sourceControl: { getBySessionId: sessionId => sourceControl.sessions.getBySessionId(sessionId) },
            workItems: seeded.workItems,
          });
          resolved.push(tenant);
          return tenant;
        });
      }
      const phase = await sourceControl.sessions.create({
        sessionId: randomUUID(),
        projectRepositoryId: link.id,
        factoryProjectId: project.id,
        orgId: ORG,
        userId: owner,
        branch: 'factory/issue-49',
        baseBranch: 'main',
        visibility: 'org',
      });
      const { item } = await seeded.workItems.prepareRunStart({
        orgId: ORG,
        userId: owner,
        factoryProjectId: project.id,
        workItem: {
          input: {
            board: 'work',
            externalSource: { integrationId: 'github', type: 'issue', externalId: '49' },
            title: 'Broken login',
            stages: ['plan'],
            sessions: {},
            metadata: {},
          },
        },
        role: 'plan',
        session: { sessionId: phase.sessionId, branch: phase.branch, threadId: phase.sessionId },
        resourceId: phase.sessionId,
        kickoffKey: 'kickoff-1',
        kickoffMessage: null,
      });
      const requesterSessionId = randomUUID();
      await sourceControl.sessions.create({
        sessionId: requesterSessionId,
        projectRepositoryId: link.id,
        factoryProjectId: project.id,
        orgId: ORG,
        userId: REQUESTER,
        branch: `user/session-${requesterSessionId}`,
        baseBranch: 'main',
        visibility: 'org',
      });
      await seeded.workItems.subscribeToWorkItem({
        orgId: ORG,
        factoryProjectId: project.id,
        workItemId: item.id,
        sessionId: requesterSessionId,
        threadId: requesterSessionId,
        resourceId: requesterSessionId,
        userId: REQUESTER,
        reason: 'created',
      });

      const ownerContext = () => new RequestContext([['user', { workosId: owner, organizationId: ORG }]]);
      const session = await code.controller.createSession({
        id: phase.sessionId,
        resourceId: phase.sessionId,
        threadId: phase.sessionId,
        ownerId: owner,
        requestContext: ownerContext(),
      });
      const errors: string[] = [];
      session.subscribe(event => {
        if (event.type === 'error') errors.push(event.error.message);
      });
      if (parkedOn === 'plan') await session.mode.switch({ modeId: 'plan' });
      void session.sendMessage({ content: 'Plan the fix.', requestContext: ownerContext() }).catch(() => {});
      /** The tool the run is stopped on, however it stopped. */
      const waitingOn = () =>
        session.suspensions.resolve({ toolCallId: parked.toolCallId })?.toolName ??
        session.approval.list().find(gate => gate.toolCallId === parked.toolCallId)?.toolName;
      await vi.waitFor(() => expect(waitingOn()).toBe(parked.toolName), { timeout: 30_000 });
      expect(errors).toEqual([]);

      const scope: FactoryToolScope = {
        orgId: ORG,
        factoryProjectId: project.id,
        userId: REQUESTER,
        sessionId: requesterSessionId,
        resourceId: requesterSessionId,
        threadId: requesterSessionId,
        kind: 'user',
        interactive: true,
      };
      const audit: Array<{ actorId: string }> = [];
      const profileLookups: string[] = [];
      const tools = createFactoryApprovalTools(scope, {
        sessions: sourceControl.sessions,
        workItems: seeded.workItems,
        auditRecorder: { record: (event: { actorId: string }) => audit.push(event) } as never,
        messaging: async () => ({ controller: code.controller }) as never,
      });
      const answer = (decision: 'approve' | 'decline') =>
        (
          tools.factory_answer_approval as unknown as {
            execute: (input: unknown, context: unknown) => Promise<unknown>;
          }
        ).execute({ sessionId: phase.sessionId, toolCallId: parked.toolCallId, decision }, {});
      /** The web app, signed in as `viewer`. */
      const web = (viewer: string) => {
        const app = new Hono();
        app.use('*', async (context, next) => {
          context.set('factoryAuthUser' as never, { workosId: viewer, organizationId: ORG } as never);
          await next();
        });
        mountApiRoutes(
          app as never,
          buildSourceControlSessionRoutes({
            auth: fakeRouteAuth({ isOrganizationAdmin: async () => false }),
            sourceControls: [sourceControl],
            projects: seeded.projects,
            memorySettings: seeded.memorySettings,
            users: {
              getUser: async (userId: string) => {
                profileLookups.push(userId);
                return { id: userId, name: `Person ${userId}` };
              },
            } as never,
            controller: code.controller as never,
            audit: { record: (event: { actorId: string }) => audit.push(event) } as never,
            workItems: seeded.workItems,
          }),
        );
        return app;
      };
      const answerOnWeb = (viewer: string, decision: 'approve' | 'decline', toolCallId?: string) =>
        web(viewer).request(`/web/user-sessions/${phase.sessionId}/parked-approval`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision, ...(toolCallId ? { toolCallId } : {}) }),
        });
      return {
        answer,
        answerOnWeb,
        web,
        errors,
        audit,
        session,
        project,
        item,
        requesterSessionId,
        phase,
        owner,
        profileLookups,
        waitingOn,
        shipped,
        sourceControl,
      };
    }

    // Technical: the resumed run takes the request context the answer hands it. It must name
    // the phase session's owner, so the run keeps one identity from kickoff to finish and never
    // runs with no user ("the request has no authenticated user" on a Factory server).
    it("carries on as the phase session's owner, and records who approved", async () => {
      const { answer, errors, audit } = await parkedPhaseSession();
      const requestsBefore = mock.getRequests().length;
      resolved = [];

      await answer('approve');

      await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(requestsBefore), { timeout: 30_000 });
      expect(errors).toEqual([]);
      expect(resolved.length).toBeGreaterThan(0);
      expect([...new Set(resolved.map(tenant => tenant?.userId))]).toEqual([OWNER]);
      expect(audit.map(event => event.actorId)).toEqual([REQUESTER]);
    });

    it('lets the person who asked approve the plan on the web, and the run carries on as its owner', async () => {
      const { answerOnWeb, errors, audit } = await parkedPhaseSession();
      const requestsBefore = mock.getRequests().length;
      resolved = [];

      const response = await answerOnWeb(REQUESTER, 'approve');

      expect(response.status).toBe(200);
      await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(requestsBefore), { timeout: 30_000 });
      expect(errors).toEqual([]);
      expect([...new Set(resolved.map(tenant => tenant?.userId))]).toEqual([OWNER]);
      expect(audit.map(event => event.actorId)).toEqual([REQUESTER]);
    });

    // A card a webhook filed runs as the Factory. The person following it approves the plan; the
    // run must carry on as the Factory in the organization's credential scope, never as the approver.
    it.each(['tool', 'web'] as const)(
      "carries on as the Factory, on the organization's credentials, when a follower approves its plan (%s)",
      async surface => {
        const { answer, answerOnWeb, errors, audit, owner } = await parkedPhaseSession({ ownedByFactory: true });
        const requestsBefore = mock.getRequests().length;
        resolved = [];

        if (surface === 'tool') await answer('approve');
        else expect((await answerOnWeb(REQUESTER, 'approve')).status).toBe(200);

        await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(requestsBefore), { timeout: 30_000 });
        expect(errors).toEqual([]);
        expect([...new Set(resolved.map(tenant => `${tenant?.userId} ${tenant?.credentialScope}`))]).toEqual([
          `${owner} factory`,
        ]);
        expect(audit.map(event => event.actorId)).toEqual([REQUESTER]);
      },
    );

    it('names the Factory as the owner of its own session, without looking it up as a person', async () => {
      const { web, project, phase, owner, profileLookups } = await parkedPhaseSession({ ownedByFactory: true });

      const response = await web(REQUESTER).request(`/web/factory/projects/${project.id}/sessions`);

      expect(response.status).toBe(200);
      const { sessions } = (await response.json()) as {
        sessions: Array<{ sessionId: string; userId: string; owner?: { id: string; name: string } }>;
      };
      expect(sessions.find(row => row.sessionId === phase.sessionId)).toMatchObject({
        userId: owner,
        owner: { id: owner, name: 'Factory' },
      });
      expect(profileLookups).toEqual([REQUESTER]);
    });

    it('refuses a teammate who neither owns the session nor follows its card, and leaves the plan waiting', async () => {
      const { answerOnWeb, waitingOn, audit } = await parkedPhaseSession();
      const requestsBefore = mock.getRequests().length;

      const response = await answerOnWeb(STRANGER, 'approve');

      expect(response.status).toBe(403);
      expect(waitingOn()).toBe('submit_plan');
      expect(mock.getRequests().length).toBe(requestsBefore);
      expect(audit).toEqual([]);
    });

    // Approval belongs to the tool, not to plans: a board's own tool that waits for a person is
    // answered the same way, from the same places, and the run carries on as its owner.
    it.each(['tool', 'web'] as const)(
      'lets the person who asked approve a tool call that is not a plan, and the run carries on as its owner (%s)',
      async surface => {
        const { answer, answerOnWeb, errors, audit, shipped } = await parkedPhaseSession({ parkedOn: 'release' });
        const requestsBefore = mock.getRequests().length;
        resolved = [];

        if (surface === 'tool') {
          await answer('approve');
        } else {
          const response = await answerOnWeb(REQUESTER, 'approve');
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({ answered: 'approve', ...PARKED.release });
        }

        await vi.waitFor(() => expect(shipped).toEqual(['1.2.0']), { timeout: 30_000 });
        await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(requestsBefore), { timeout: 30_000 });
        expect(errors).toEqual([]);
        expect([...new Set(resolved.map(tenant => tenant?.userId))]).toEqual([OWNER]);
        expect(audit.map(event => event.actorId)).toEqual([REQUESTER]);
      },
    );

    it('declines a tool call that is not a plan from the web, so the tool never runs', async () => {
      const { answerOnWeb, errors, shipped, waitingOn } = await parkedPhaseSession({ parkedOn: 'release' });
      const requestsBefore = mock.getRequests().length;

      const response = await answerOnWeb(REQUESTER, 'decline', PARKED.release.toolCallId);

      expect(response.status).toBe(200);
      await vi.waitFor(() => expect(mock.getRequests().length).toBeGreaterThan(requestsBefore), { timeout: 30_000 });
      expect(waitingOn()).toBeUndefined();
      expect(shipped).toEqual([]);
      expect(errors).toEqual([]);
    });

    it('leaves a question for the person to answer in the session, rather than approving it', async () => {
      const { answerOnWeb, waitingOn, audit } = await parkedPhaseSession({ parkedOn: 'question' });
      const requestsBefore = mock.getRequests().length;

      const response = await answerOnWeb(REQUESTER, 'approve');

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: 'This session is not waiting on an approval. Open it to see what it needs.',
      });
      expect(waitingOn()).toBe('ask_user');
      expect(mock.getRequests().length).toBe(requestsBefore);
      expect(audit).toEqual([]);
    });

    // A follow belongs to the session that made it. Once that session is handed to someone else,
    // the new owner is the one who asked, and the previous owner no longer answers through it.
    it('follows the session to its new owner when the following session is handed over', async () => {
      const { answerOnWeb, waitingOn, sourceControl, requesterSessionId } = await parkedPhaseSession();
      await sourceControl.sessions.transferOwner({
        sessionId: requesterSessionId,
        expectedUserId: REQUESTER,
        toUserId: STRANGER,
      });

      expect((await answerOnWeb(REQUESTER, 'approve')).status).toBe(403);
      expect(waitingOn()).toBe('submit_plan');

      expect((await answerOnWeb(STRANGER, 'approve')).status).toBe(200);
    });

    it("tells the web app which cards each session follows, so it can list a card's sessions under it", async () => {
      const { web, project, item, requesterSessionId, phase } = await parkedPhaseSession();

      const response = await web(REQUESTER).request(`/web/factory/projects/${project.id}/sessions`);

      expect(response.status).toBe(200);
      const { sessions } = (await response.json()) as {
        sessions: Array<{ sessionId: string; followedWorkItemIds: string[] }>;
      };
      const followed = Object.fromEntries(sessions.map(row => [row.sessionId, row.followedWorkItemIds]));
      expect(followed).toEqual({ [requesterSessionId]: [item.id], [phase.sessionId]: [] });
    });
  },
);
