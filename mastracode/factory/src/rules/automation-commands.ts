import { createHash, randomUUID } from 'node:crypto';
import type { MastraCodeState } from '@mastra/code-sdk/schema';
import type { AgentController } from '@mastra/core/agent-controller';
import type { MemorySettingsStorage } from '../storage/domains/memory-settings/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { FactoryRunBindingRecord, WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FactoryStartCoordinator } from './start-coordinator.js';
import type { FactoryStartPreparedResult, FactoryStartRequest } from './start-coordinator.js';
import type { FactoryTransitionRequest, FactoryTransitionService } from './transition-service.js';
import type { FactoryTransitionResult } from './types.js';

export interface FactoryAutomationTransitionRequest extends Omit<FactoryTransitionRequest, 'actor' | 'ingress'> {
  idempotencyKey: string;
}

export interface FactoryAutomatedStartInput {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  projectRepositoryId: string;
  projectItemNodeId: string;
  contentNodeId: string;
  repositoryNameWithOwner: string;
  number: number;
  title: string;
  url: string;
  kickoffKey: string;
  prompt: string;
  role: string;
  destinationStage: FactoryStartRequest['destinationStage'];
  defaultModelId?: string;
  workItemId?: string;
  metadata?: Record<string, unknown>;
}

export interface FactoryAutomationActiveRunRequest {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
}

export type FactoryAutomationWorkItemRequest = FactoryAutomationActiveRunRequest;

/** Governed host commands exposed to trusted control-plane integrations. */
export interface FactoryAutomationCommands {
  startWorkItem(request: FactoryAutomatedStartInput): Promise<FactoryStartPreparedResult>;
  transitionWorkItem(request: FactoryAutomationTransitionRequest): Promise<FactoryTransitionResult>;
  getActiveRun(request: FactoryAutomationActiveRunRequest): Promise<FactoryRunBindingRecord | null>;
  getWorkItem(request: FactoryAutomationWorkItemRequest): Promise<WorkItemRow | null>;
}

export interface CreateFactoryAutomationCommandsOptions {
  integrationId: string;
  controller: AgentController<MastraCodeState>;
  storage: WorkItemsStorage;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  sourceControl?: SourceControlStorageHandle;
  memorySettings?: MemorySettingsStorage;
}

export function createFactoryAutomationCommands(
  options: CreateFactoryAutomationCommandsOptions,
): FactoryAutomationCommands {
  const actor = { type: 'system' as const, id: `integration:${options.integrationId}` };
  const coordinator = new FactoryStartCoordinator(
    options.controller,
    options.storage,
    options.transitionService,
    options.sourceControl,
    options.memorySettings,
  );

  const startWorkItem = async (request: FactoryAutomatedStartInput): Promise<FactoryStartPreparedResult> => {
    if (!options.sourceControl) throw new Error('Factory source control storage is unavailable');
    const projectRepository = await options.sourceControl.projectRepositories.get({
      orgId: request.orgId,
      id: request.projectRepositoryId,
    });
    if (!projectRepository) throw new Error('Factory project repository not found');
    const connection = await options.sourceControl.connections.get({
      orgId: request.orgId,
      id: projectRepository.connectionId,
    });
    if (!connection || connection.factoryProjectId !== request.factoryProjectId) {
      throw new Error('Factory project repository does not belong to this project');
    }

    const identityHash = createHash('sha256').update(request.contentNodeId).digest('hex').slice(0, 10);
    const branch = `factory/issue-${request.number}-${identityHash}`;
    const existing = await options.sourceControl.sessions.getForBranch({
      projectRepositoryId: request.projectRepositoryId,
      userId: request.userId,
      branch,
    });
    const sourceSession =
      existing ??
      (await options.sourceControl.sessions.create({
        sessionId: randomUUID(),
        projectRepositoryId: request.projectRepositoryId,
        orgId: request.orgId,
        userId: request.userId,
        branch,
        baseBranch: projectRepository.branch ?? 'main',
      }));

    return coordinator.prepare({
      orgId: request.orgId,
      userId: request.userId,
      factoryProjectId: request.factoryProjectId,
      sessionId: sourceSession.sessionId,
      threadTitle: `${request.repositoryNameWithOwner}#${request.number}: ${request.title}`,
      threadTags: {
        role: request.role,
        source: 'github-projects-v2',
        projectItemNodeId: request.projectItemNodeId,
        contentNodeId: request.contentNodeId,
      },
      kickoffKey: request.kickoffKey,
      invocation: { type: 'prompt', prompt: request.prompt },
      destinationStage: request.destinationStage,
      defaultModelId: request.defaultModelId,
      actor,
      workItem: {
        id: request.workItemId,
        role: request.role,
        input: {
          externalSource: {
            integrationId: 'github-projects-v2',
            type: 'issue',
            externalId: request.contentNodeId,
            url: request.url,
          },
          title: request.title,
          stages: ['intake'],
          metadata: {
            repositoryNameWithOwner: request.repositoryNameWithOwner,
            issueNumber: request.number,
            projectItemNodeId: request.projectItemNodeId,
            contentNodeId: request.contentNodeId,
            ...(request.metadata ?? {}),
          },
        },
      },
    });
  };

  return {
    startWorkItem,
    transitionWorkItem: request => {
      const { idempotencyKey, ...transition } = request;
      return options.transitionService.transition({
        ...transition,
        actor,
        ingress: {
          type: 'rule',
          identity: `automation:${options.integrationId}:${idempotencyKey}`,
        },
      });
    },
    getActiveRun: async request => {
      const bindings = await options.storage.listRunBindings(
        request.orgId,
        request.factoryProjectId,
        request.workItemId,
      );
      return bindings.findLast(binding => binding.status === 'active') ?? null;
    },
    getWorkItem: request => options.storage.getForProject(request.orgId, request.factoryProjectId, request.workItemId),
  };
}
