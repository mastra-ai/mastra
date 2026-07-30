import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { formatSkillActivation } from '@mastra/core/workspace';

import type { MemorySettingsRecord, MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { SourceControlSession, SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type {
  CreateWorkItemInput,
  PrepareFactoryRunStartResult,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import { getBundledFactorySkill } from '../workspace.js';
import type { FactoryTransitionService } from './transition-service.js';
import type { FactoryRuleStage, FactoryTransitionResult } from './types.js';

export interface FactoryStartRequest {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  sessionId: string;
  threadTitle: string;
  threadTags?: Record<string, string>;
  kickoffKey: string;
  invocation?: { type: 'prompt'; prompt: string } | { type: 'skill'; skillName: string; arguments: string };
  destinationStage: FactoryRuleStage;
  defaultModelId?: string;
  workItem: {
    id?: string;
    role: string;
    input: CreateWorkItemInput;
  };
  requestContext?: RequestContext;
}

export class FactoryStartTransitionError extends Error {
  readonly result: Extract<FactoryTransitionResult, { status: 'rejected' }>;

  constructor(result: Extract<FactoryTransitionResult, { status: 'rejected' }>) {
    super(result.reason);
    this.name = 'FactoryStartTransitionError';
    this.result = result;
  }
}

export interface FactoryStartPreparedResult {
  workItemId: string;
  bindingId: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
  branch: string;
  revision: number;
  kickoffStatus: 'blocked' | 'pending' | 'leased' | 'retry' | 'sent' | 'failed';
  replayed: boolean;
  /**
   * Settles when the background finalize phase (session creation, thread
   * config, kickoff release) completes. Rejects if finalize fails — the
   * pending start is marked `failed` first, so callers that don't await
   * this still converge via storage state.
   */
  finalized: Promise<void>;
}

type FactoryController = AgentController<MastraCodeState>;
type FactorySession = Awaited<ReturnType<FactoryController['createSession']>>;

function escapeSkillBoundary(value: string): string {
  return value.replaceAll('</skill>', '&lt;/skill&gt;');
}

function buildSkillKickoff(skill: { name: string }, activation: string, argumentsRaw: string): string {
  const args = argumentsRaw.trim();
  const content = `${activation}${args ? `\n\nARGUMENTS: ${args}` : ''}`.trim();
  return `<skill name="${skill.name}">\n${escapeSkillBoundary(content)}\n</skill>`;
}

type FastKickoffResolution = { deferred: false; message: string | null } | { deferred: true };

/**
 * Resolve the kickoff message without a live session. Prompts and bundled
 * factory skills (the common case — review/plan/triage cards) resolve from
 * server-local files; project skills need the session workspace and are
 * deferred to the finalize phase.
 */
async function resolveKickoffMessageFast(
  invocation: FactoryStartRequest['invocation'],
): Promise<FastKickoffResolution> {
  if (!invocation) return { deferred: false, message: null };
  if (invocation.type === 'prompt') return { deferred: false, message: invocation.prompt };
  const skill = await getBundledFactorySkill(invocation.skillName);
  if (!skill) return { deferred: true };
  if (skill['user-invocable'] === false) {
    throw new Error(`Skill not found: ${invocation.skillName}.`);
  }
  return { deferred: false, message: buildSkillKickoff(skill, formatSkillActivation(skill), invocation.arguments) };
}

/** Resolve a project (workspace) skill kickoff — requires the live session. */
async function resolveKickoffMessageFromSession(
  session: FactorySession,
  invocation: Extract<FactoryStartRequest['invocation'], { type: 'skill' }>,
): Promise<string> {
  const skills = session.getWorkspace().skills;
  await skills?.maybeRefresh();
  const skill = await skills?.get(invocation.skillName);
  if (!skill || skill['user-invocable'] === false) {
    throw new Error(`Skill not found: ${invocation.skillName}.`);
  }
  return buildSkillKickoff(skill, formatSkillActivation(skill), invocation.arguments);
}

async function resolveSourceSession(
  storage: SourceControlStorageHandle,
  request: FactoryStartRequest,
): Promise<SourceControlSession> {
  const session = await storage.sessions.getBySessionId(request.sessionId);
  if (!session || session.orgId !== request.orgId || session.userId !== request.userId) {
    throw new Error('Factory session not found');
  }
  const projectRepository = await storage.projectRepositories.get({
    orgId: request.orgId,
    id: session.projectRepositoryId,
  });
  if (!projectRepository) throw new Error('Factory session repository not found');
  const connection = await storage.connections.get({ orgId: request.orgId, id: projectRepository.connectionId });
  if (!connection || connection.factoryProjectId !== request.factoryProjectId) {
    throw new Error('Factory session does not belong to this project');
  }
  return session;
}

async function configureThread(session: FactorySession, request: FactoryStartRequest): Promise<string> {
  const threadId = session.thread.requireId();
  await session.thread.rename({ title: request.threadTitle });
  const settings = { ...(request.threadTags ?? {}), factorySessionId: request.sessionId };
  await Promise.all(Object.entries(settings).map(([key, value]) => session.thread.setSetting({ key, value })));
  return threadId;
}

async function applyMemorySettings(session: FactorySession, record: MemorySettingsRecord | null): Promise<void> {
  if (record?.observerModelId) await session.om.observer.switchModel({ modelId: record.observerModelId });
  if (record?.reflectorModelId) await session.om.reflector.switchModel({ modelId: record.reflectorModelId });

  const state = {
    ...(record?.observationThreshold != null ? { observationThreshold: record.observationThreshold } : {}),
    ...(record?.reflectionThreshold != null ? { reflectionThreshold: record.reflectionThreshold } : {}),
    ...(record?.observeAttachments != null ? { observeAttachments: record.observeAttachments } : {}),
  };
  if (Object.keys(state).length > 0) await session.state.set(state);
}

export class FactoryStartCoordinator {
  readonly #controller: FactoryController;
  readonly #storage: WorkItemsStorage;
  readonly #transitionService?: Pick<FactoryTransitionService, 'transition'>;
  readonly #sourceControl?: SourceControlStorageHandle;
  readonly #memorySettings?: MemorySettingsStorage;

  constructor(
    controller: FactoryController,
    storage: WorkItemsStorage,
    transitionService?: Pick<FactoryTransitionService, 'transition'>,
    sourceControl?: SourceControlStorageHandle,
    memorySettings?: MemorySettingsStorage,
  ) {
    this.#controller = controller;
    this.#storage = storage;
    this.#transitionService = transitionService;
    this.#sourceControl = sourceControl;
    this.#memorySettings = memorySettings;
  }

  /**
   * Fast phase: record the run start (work item, binding, `blocked` pending
   * start) and run the stage transition — no session or sandbox work. Returns
   * as soon as the client can navigate to the thread. Session creation,
   * thread config, and kickoff release happen in a background finalize phase
   * (`result.finalized`); the dispatcher cannot claim the kickoff until the
   * finalize releases it.
   */
  async prepare(request: FactoryStartRequest): Promise<FactoryStartPreparedResult> {
    const storage = this.#storage;
    if (!this.#sourceControl) throw new Error('Factory source control storage is unavailable');
    const sourceSession = await resolveSourceSession(this.#sourceControl, request);
    const requestContext = request.requestContext ?? new RequestContext();
    if (!request.requestContext) {
      requestContext.set('user', { workosId: request.userId, organizationId: request.orgId });
    }
    const kickoff = await resolveKickoffMessageFast(request.invocation);
    const threadId = sourceSession.sessionId;
    const prepared = await storage.prepareRunStart({
      orgId: request.orgId,
      userId: request.userId,
      factoryProjectId: request.factoryProjectId,
      workItem: { id: request.workItem.id, input: request.workItem.input },
      role: request.workItem.role,
      session: { sessionId: sourceSession.sessionId, branch: sourceSession.branch, threadId },
      resourceId: sourceSession.sessionId,
      kickoffKey: request.kickoffKey,
      kickoffMessage: kickoff.deferred ? null : kickoff.message,
      kickoffStatus: 'blocked',
    });

    let revision = prepared.item.revision;
    if (prepared.item.stages.length !== 1 || prepared.item.stages[0] !== request.destinationStage) {
      if (!this.#transitionService) throw new Error('Factory transition service is unavailable.');
      const transition = await this.#transitionService.transition({
        orgId: request.orgId,
        factoryProjectId: request.factoryProjectId,
        workItemId: prepared.item.id,
        board: prepared.item.externalSource?.type === 'pull-request' ? 'review' : 'work',
        stage: request.destinationStage,
        expectedRevision: prepared.item.revision,
        actor: { type: 'human', id: request.userId },
        ingress: { type: 'human', identity: `start:${request.kickoffKey}:transition` },
        cause: 'run_start',
      });
      if (transition.status === 'rejected') {
        await storage.markPendingStart(prepared.binding.id, 'failed', transition.reason);
        throw new FactoryStartTransitionError(transition);
      }
      revision = transition.revision;
    }

    // A replayed prepare whose pending start already left `blocked` was
    // finalized by an earlier call — don't redo session setup. A replayed
    // `blocked` start means the earlier finalize is either still running
    // (idempotent to run again) or died with the server (this is the retry).
    const needsFinalize = prepared.pendingStart.status === 'blocked';
    const finalized = needsFinalize
      ? this.#finalize({ request, sourceSession, requestContext, prepared, kickoff })
      : Promise.resolve();
    // Background callers (the runs/start route) don't await this; keep the
    // rejection observed so a finalize failure never crashes the process.
    finalized.catch(() => {});

    return {
      workItemId: prepared.item.id,
      bindingId: prepared.binding.id,
      threadId,
      resourceId: sourceSession.sessionId,
      sessionId: sourceSession.sessionId,
      branch: sourceSession.branch,
      revision,
      kickoffStatus: prepared.pendingStart.status,
      replayed: prepared.replayed,
      finalized,
    };
  }

  /**
   * Finalize phase: create the controller session (materializes the sandbox),
   * seed its state and thread settings, resolve any deferred project-skill
   * kickoff, then release the pending start so the dispatcher delivers it.
   */
  async #finalize(args: {
    request: FactoryStartRequest;
    sourceSession: SourceControlSession;
    requestContext: RequestContext;
    prepared: PrepareFactoryRunStartResult;
    kickoff: FastKickoffResolution;
  }): Promise<void> {
    const { request, sourceSession, requestContext, prepared, kickoff } = args;
    const storage = this.#storage;
    try {
      // Sessions kicked off against third-party content (a PR under review, or
      // any pull-request-sourced work item) get `untrustedCheckout` so the SDK
      // never ingests the checkout's AGENTS.md/CLAUDE.md into the system prompt
      // or reminders — those files are attacker-writable in a PR branch.
      const untrustedCheckout =
        request.workItem.input.externalSource?.type === 'pull-request' ||
        (request.invocation?.type === 'skill' && request.invocation.skillName === 'factory-review');
      // The trusted ref the SDK may serve project instruction files from on an
      // untrusted checkout (the PR's base branch). Prefer the session record's
      // base branch; fall back to the intake metadata captured from the PR.
      const metadataBaseBranch = request.workItem.input.metadata?.baseBranch;
      const baseRef =
        (sourceSession.baseBranch || undefined) ??
        (typeof metadataBaseBranch === 'string' && metadataBaseBranch ? metadataBaseBranch : undefined);
      const sessionTags = {
        factoryProjectId: request.factoryProjectId,
        projectRepositoryId: sourceSession.projectRepositoryId,
      };
      const session = await this.#controller.createSession({
        id: sourceSession.sessionId,
        ownerId: request.userId,
        resourceId: sourceSession.sessionId,
        threadId: sourceSession.sessionId,
        requestContext,
        tags: sessionTags,
      });
      // Bound-agent authority gates (the transition tool, the factory-phase
      // processor, workspace token selection) resolve the session address from
      // controller state. Seed it server-side — `tags` covers fresh creation,
      // the explicit setState covers get-or-create returning a session another
      // caller created without them — so autonomous runs never depend on a
      // browser connecting to populate the state. `untrustedCheckout` is a
      // boolean so it rides only on state (tags are string-valued).
      await session.state.set({
        ...sessionTags,
        ...(untrustedCheckout ? { untrustedCheckout: true, ...(baseRef ? { baseRef } : {}) } : {}),
      });
      if (this.#memorySettings) {
        try {
          const record = await this.#memorySettings.get({ orgId: request.orgId, userId: request.userId });
          await applyMemorySettings(session, record);
        } catch (error) {
          console.warn('[Factory Start] Failed to apply observational-memory settings', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (request.defaultModelId) {
        try {
          await session.model.switch({ modelId: request.defaultModelId });
        } catch (error) {
          console.warn('[Factory Start] Failed to apply factory default model', {
            modelId: request.defaultModelId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      await configureThread(session, request);
      await session.thread.setSetting({ key: 'factoryWorkItemId', value: prepared.item.id });

      const deferredMessage =
        kickoff.deferred && request.invocation?.type === 'skill'
          ? await resolveKickoffMessageFromSession(session, request.invocation)
          : undefined;

      if (!kickoff.deferred && kickoff.message === null) {
        // No kickoff to deliver — the dispatcher has nothing to claim.
        await storage.markPendingStart(prepared.binding.id, 'sent');
      } else {
        await storage.releasePendingStart({
          id: prepared.pendingStart.id,
          orgId: request.orgId,
          factoryProjectId: request.factoryProjectId,
          ...(deferredMessage !== undefined ? { message: deferredMessage } : {}),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Factory Start] Finalize failed', {
        bindingId: prepared.binding.id,
        workItemId: prepared.item.id,
        error: message,
      });
      await storage.markPendingStart(prepared.binding.id, 'failed', message).catch(() => {});
      throw error;
    }
  }
}
