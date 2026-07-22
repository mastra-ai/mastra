import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { RequestContext } from '@mastra/core/request-context';

import type { FactoryTransitionApprovalService } from '../rules/approval-service.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_SUPERVISOR_INSTRUCTIONS } from './instructions.js';
import { buildFactorySupervisorState } from './state.js';
import type { FactorySupervisorState } from './state.js';

export const FACTORY_SUPERVISOR_SESSION_SUFFIX = '-supervisor';

export function factorySupervisorThreadId(factoryProjectId: string): string {
  return `${factoryProjectId}${FACTORY_SUPERVISOR_SESSION_SUFFIX}`;
}

export interface FactorySupervisorAddress {
  factoryProjectId: string;
  resourceId: string;
  sessionId: string;
  threadId: string;
}

export interface FactorySupervisorServiceOptions {
  controller: AgentController<MastraCodeState>;
  projects: FactoryProjectsStorage;
  workItems: WorkItemsStorage;
  approvals: Pick<FactoryTransitionApprovalService, 'list' | 'get' | 'resolve'>;
  primeCredentials?: (tenant: { orgId: string; userId: string }) => Promise<void>;
}

export class FactorySupervisorService {
  readonly #controller: AgentController<MastraCodeState>;
  readonly #projects: FactoryProjectsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #approvals: Pick<FactoryTransitionApprovalService, 'list' | 'get' | 'resolve'>;
  readonly #primeCredentials?: FactorySupervisorServiceOptions['primeCredentials'];
  readonly #pending = new Map<string, Promise<FactorySupervisorAddress>>();

  constructor(options: FactorySupervisorServiceOptions) {
    this.#controller = options.controller;
    this.#projects = options.projects;
    this.#workItems = options.workItems;
    this.#approvals = options.approvals;
    this.#primeCredentials = options.primeCredentials;
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
    const live = await this.#controller.getSessionByResource(input.factoryProjectId);
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
        resourceId: input.factoryProjectId,
        sessionId: threadId,
        threadId,
      };
    }

    const session = await this.#controller.createSession({
      id: threadId,
      ownerId: `factory:${input.orgId}`,
      resourceId: input.factoryProjectId,
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
      resourceId: input.factoryProjectId,
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
      thread.resourceId !== factoryProjectId ||
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
    const [items, approvals] = await Promise.all([
      this.#workItems.list(input),
      this.#approvals.list({ ...input, statuses: ['pending'] }),
    ]);
    return buildFactorySupervisorState(input.factoryProjectId, items, approvals);
  }
}
