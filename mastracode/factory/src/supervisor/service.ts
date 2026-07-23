import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { FactoryTransitionApprovalService } from '../rules/approval-service.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SUPERVISOR_INSTRUCTIONS } from './instructions.js';
import { buildFactorySupervisorState } from './state.js';
import type { FactorySupervisorState, FactorySupervisorWorkerBinding } from './state.js';

export const FACTORY_SUPERVISOR_SESSION_SUFFIX = '-supervisor';

export function factorySupervisorThreadId(factoryProjectId: string): string {
  return `${factoryProjectId}${FACTORY_SUPERVISOR_SESSION_SUFFIX}`;
}

/**
 * The supervisor owns a dedicated controller resource. The bare factory id is
 * already claimed by the factory-level session that `/ensure` provisions for
 * settings/permissions surfaces, and the controller registry allows only one
 * live session per (resourceId, scope) — sharing that resource made every
 * supervisor open collide with an existing non-supervisor session.
 */
export function factorySupervisorResourceId(factoryProjectId: string): string {
  return `${factoryProjectId}${FACTORY_SUPERVISOR_SESSION_SUFFIX}`;
}

export interface FactorySupervisorAddress {
  factoryProjectId: string;
  resourceId: string;
  sessionId: string;
  threadId: string;
}

/** The stored workspace coordinates a session record re-supplies on reopen. */
export interface FactoryStoredWorkerSession {
  orgId: string;
  projectRepositoryId: string;
  sandboxId: string | null;
  sandboxWorkdir: string | null;
}

export interface FactorySupervisorServiceOptions {
  controller: AgentController<MastraCodeState>;
  projects: FactoryProjectsStorage;
  workItems: WorkItemsStorage;
  approvals: Pick<FactoryTransitionApprovalService, 'list' | 'get' | 'resolve'>;
  primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
  /** Stored session lookup used to restore worker workspace state on reopen. */
  storedSessions?: { getBySessionId(sessionId: string): Promise<FactoryStoredWorkerSession | null> };
}

export class FactorySupervisorService {
  readonly #controller: AgentController<MastraCodeState>;
  readonly #projects: FactoryProjectsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #approvals: Pick<FactoryTransitionApprovalService, 'list' | 'get' | 'resolve'>;
  readonly #primeCredentials?: FactorySupervisorServiceOptions['primeCredentials'];
  readonly #storedSessions?: FactorySupervisorServiceOptions['storedSessions'];
  readonly #pending = new Map<string, Promise<FactorySupervisorAddress>>();

  constructor(options: FactorySupervisorServiceOptions) {
    this.#controller = options.controller;
    this.#projects = options.projects;
    this.#workItems = options.workItems;
    this.#approvals = options.approvals;
    this.#primeCredentials = options.primeCredentials;
    this.#storedSessions = options.storedSessions;
  }

  get controller(): AgentController<MastraCodeState> {
    return this.#controller;
  }

  get workItems(): WorkItemsStorage {
    return this.#workItems;
  }

  get approvals(): Pick<FactoryTransitionApprovalService, 'list' | 'get' | 'resolve'> {
    return this.#approvals;
  }

  async #getProject(input: { orgId: string; factoryProjectId: string }) {
    await this.#projects.ensureReady();
    const project = await this.#projects.get({ orgId: input.orgId, id: input.factoryProjectId });
    if (!project) throw new Error('Factory project not found.');
    return project;
  }

  async requireProject(input: { orgId: string; factoryProjectId: string }): Promise<void> {
    await this.#getProject(input);
  }

  async ensureSession(input: {
    orgId: string;
    userId: string;
    factoryProjectId: string;
    requestContext?: RequestContext;
  }): Promise<FactorySupervisorAddress> {
    const project = await this.#getProject(input);
    await this.#primeCredentials?.({ orgId: input.orgId, userId: input.userId });

    const key = `${input.orgId}\u0000${input.factoryProjectId}`;
    const existing = this.#pending.get(key);
    if (existing) return existing;

    const creation = this.#ensureCanonicalSession(input, project.defaultModelId ?? undefined).finally(() => {
      if (this.#pending.get(key) === creation) this.#pending.delete(key);
    });
    this.#pending.set(key, creation);
    return creation;
  }

  async #ensureCanonicalSession(
    input: {
      orgId: string;
      userId: string;
      factoryProjectId: string;
      requestContext?: RequestContext;
    },
    defaultModelId?: string,
  ): Promise<FactorySupervisorAddress> {
    const threadId = factorySupervisorThreadId(input.factoryProjectId);
    const resourceId = factorySupervisorResourceId(input.factoryProjectId);
    const live = await this.#controller.getSessionByResource(resourceId);
    if (live) {
      const state = live.state.get();
      if (
        state.factoryProjectId !== input.factoryProjectId ||
        state.factoryOrgId !== input.orgId ||
        (state.factorySupervisor !== true && state.factorySupervisor !== 'true')
      ) {
        throw new Error('Factory supervisor resource is already bound to a non-canonical session.');
      }
      if (live.thread.getId() !== threadId) await live.thread.switch({ threadId, emitEvent: false });
      await this.#configureSession(live, input.orgId, input.factoryProjectId, threadId);
      return {
        factoryProjectId: input.factoryProjectId,
        resourceId,
        sessionId: threadId,
        threadId,
      };
    }

    const session = await this.#controller.createSession({
      id: threadId,
      ownerId: `factory:${input.orgId}`,
      resourceId,
      threadId,
      tags: {
        factoryProjectId: input.factoryProjectId,
        factoryOrgId: input.orgId,
        factorySupervisor: 'true',
        ...(defaultModelId ? { currentModelId: defaultModelId } : {}),
      },
      requestContext: input.requestContext,
    });
    await this.#configureSession(session, input.orgId, input.factoryProjectId, threadId);
    return {
      factoryProjectId: input.factoryProjectId,
      resourceId,
      sessionId: threadId,
      threadId,
    };
  }

  async #configureSession(
    session: Awaited<ReturnType<AgentController<MastraCodeState>['createSession']>>,
    orgId: string,
    factoryProjectId: string,
    threadId: string,
  ): Promise<void> {
    const thread = await session.thread.getById({ threadId });
    const metadata = thread?.metadata as Record<string, unknown> | undefined;
    if (
      !thread ||
      thread.resourceId !== factorySupervisorResourceId(factoryProjectId) ||
      metadata?.factoryProjectId !== factoryProjectId ||
      metadata?.factoryOrgId !== orgId ||
      metadata?.factorySupervisor !== 'true'
    ) {
      throw new Error('Factory supervisor thread identity does not match the requested tenant and project.');
    }
    await session.thread.rename({ title: 'Factory Supervisor' });
    const current = session.state.get();
    const pluginInstructions = current.pluginInstructions.includes(FACTORY_SUPERVISOR_INSTRUCTIONS)
      ? current.pluginInstructions
      : [...current.pluginInstructions, FACTORY_SUPERVISOR_INSTRUCTIONS];
    await session.state.set({
      factoryProjectId,
      factoryOrgId: orgId,
      factorySupervisor: true,
      pluginInstructions,
      projectPath: undefined,
      projectRepositoryId: undefined,
      worktreePath: undefined,
      branch: undefined,
    });
  }

  async getState(input: { orgId: string; factoryProjectId: string }): Promise<FactorySupervisorState> {
    await this.requireProject(input);
    await this.#workItems.ensureReady();
    const [items, approvals, workers] = await Promise.all([
      this.#workItems.list(input),
      this.#approvals.list({ ...input, statuses: ['pending'] }),
      this.describeWorkerBindings(input),
    ]);
    return buildFactorySupervisorState(input.factoryProjectId, items, approvals, workers);
  }

  /**
   * Resolve the controller session for a worker binding, reopening it when no
   * in-process session exists — the same recipe the browser uses to reopen a
   * stored session after a server restart: get-or-create by resourceId, bind
   * the binding's thread, then re-supply the stored workspace coordinates
   * (repository, sandbox) into session state. A binding with no stored
   * session record simply reopens without workspace state, exactly like a
   * user opening a session with no repository.
   */
  async resolveWorkerSession(input: {
    orgId: string;
    factoryProjectId: string;
    binding: { resourceId: string; threadId: string };
    requestContext?: RequestContext;
  }) {
    const live = await this.#controller.getSessionByResource(input.binding.resourceId);
    if (live) {
      if (live.thread.getId() !== input.binding.threadId) {
        await live.thread.switch({ threadId: input.binding.threadId, emitEvent: false });
      }
      return live;
    }
    const stored = await this.#storedSessions?.getBySessionId(input.binding.resourceId);
    if (stored && stored.orgId !== input.orgId) {
      throw new Error('Factory session is not available to this tenant.');
    }
    const session = await this.#controller.createSession({
      resourceId: input.binding.resourceId,
      threadId: input.binding.threadId,
      requestContext: input.requestContext,
    });
    await session.state.set({
      factoryProjectId: input.factoryProjectId,
      ...(stored?.projectRepositoryId ? { projectRepositoryId: stored.projectRepositoryId } : {}),
      ...(stored?.sandboxId ? { sandboxId: stored.sandboxId } : {}),
      ...(stored?.sandboxWorkdir ? { sandboxWorkdir: stored.sandboxWorkdir } : {}),
    });
    return session;
  }

  /**
   * Live activity for each active run binding. A binding whose bound session
   * has a run in flight is `running`; everything else is `idle` — whether an
   * in-process session exists is a server detail the supervisor doesn't need.
   * Pure in-memory registry lookups — never creates sessions.
   */
  async describeWorkerBindings(input: {
    orgId: string;
    factoryProjectId: string;
    workItemId?: string;
  }): Promise<FactorySupervisorWorkerBinding[]> {
    const bindings = await this.#workItems.listRunBindings(input.orgId, input.factoryProjectId, input.workItemId);
    return Promise.all(
      bindings
        .filter(binding => binding.status === 'active')
        .map(async binding => {
          const session = await this.#controller.getSessionByResource(binding.resourceId);
          const activity = session?.run.isRunning() ? 'running' : 'idle';
          return { workItemId: binding.workItemId, role: binding.role, bindingId: binding.id, activity } as const;
        }),
    );
  }
}
