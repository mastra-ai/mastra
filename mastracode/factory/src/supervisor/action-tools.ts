import type { MessageAuthor } from '@mastra/core/agent-controller';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { BoardRegistry } from '../boards/index.js';
import type { IntegrationTools } from '../integrations/base.js';
import type { FactoryTransitionService } from '../rules/transition-service.js';
import type { AuditStorage } from '../storage/domains/audit/base.js';
import { actorFromAuthUser } from '../storage/domains/comments/actor.js';
import type { WorkItemCommentsStorage } from '../storage/domains/comments/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createFactoryWorkItem } from '../work-item-create.js';
import type { SupervisorScope } from './read-tools.js';

interface SupervisorActionDependencies {
  scope: SupervisorScope;
  userId: string;
  messageAuthor?: MessageAuthor;
  email?: string;
  boards: BoardRegistry;
  workItems: WorkItemsStorage;
  comments: WorkItemCommentsStorage;
  audit: AuditStorage;
  transitionService?: Pick<FactoryTransitionService, 'transition'>;
}

export function createFactorySupervisorActionTools(deps: SupervisorActionDependencies): IntegrationTools {
  return {
    factory_create_work_item: createTool({
      id: 'factory_create_work_item',
      description:
        'File a work item on behalf of the requesting person, with their brief as its first comment. No approval prompt. Check for an existing card or session covering the request first; point to it instead of filing a duplicate. Filing does not start a worker.',
      inputSchema: z.object({ title: z.string().trim().min(1).max(200), brief: z.string().min(1).max(4000) }).strict(),
      requireApproval: false,
      execute: async ({ title, brief }) => {
        const board = deps.boards.get('work');
        if (!board) throw new Error('The work board is not installed.');
        await deps.workItems.ensureReady();
        const result = await createFactoryWorkItem({
          ...deps.scope,
          userId: deps.userId,
          actor: { type: 'human', id: deps.userId },
          ingressType: 'human',
          board: board.id,
          stage: board.initialPhase,
          input: { title, board: board.id, stages: [board.initialPhase] },
          workItems: deps.workItems,
          transitionService: deps.transitionService,
          beforeEntry: async item => {
            await deps.comments.create({
              ...deps.scope,
              workItemId: item.id,
              author: actorFromAuthUser(deps.userId, {
                name: deps.messageAuthor?.name,
                email: deps.email,
                avatarUrl: deps.messageAuthor?.avatarUrl,
              }),
              body: brief,
            });
          },
        });
        if (result.status === 'unavailable') throw new Error('This factory cannot accept new work items right now.');
        if (result.status === 'rejected') throw new Error(`Work item was not filed: ${result.reason}`);
        const item = result.item;
        await deps.audit.record({
          ...deps.scope,
          actorId: deps.userId,
          actorType: 'human',
          action: 'factory.work_item.created',
          targets: [{ type: 'work_item', id: item.id, name: item.title }],
          metadata: {
            cause: 'supervisor',
            title: item.title,
            stages: item.stages,
            requestedBy: deps.userId,
            briefPosted: true,
          },
        });
        return {
          workItemId: item.id,
          title: item.title,
          stages: item.stages,
          requestedBy: deps.userId,
          briefPosted: true,
        };
      },
    }),
  };
}
