import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../../factory-integration';
import type { WorkItemsStorage } from '../../storage/domains/work-items/base';
import { getFactorySessionAddress } from './binding-context';
import { FACTORY_RULE_STAGES } from './types';
import type { FactoryRuleBoard } from './types';
import type { FactoryTransitionService } from './transition-service';

const transitionInputSchema = z
  .object({
    stage: z.enum(FACTORY_RULE_STAGES),
    expectedRevision: z.number().int().positive(),
    rationale: z.string().trim().min(1).max(1_000),
  })
  .strict();

function boardForSource(type: string | undefined): FactoryRuleBoard {
  return type === 'pull-request' ? 'review' : 'work';
}

export async function createFactoryTransitionTools(options: {
  requestContext: RequestContext;
  storage: WorkItemsStorage;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
}): Promise<IntegrationTools> {
  const address = getFactorySessionAddress(options.requestContext);
  if (!address) return {};
  const availableBinding = await options.storage.findActiveRunBinding(address);
  if (!availableBinding) return {};

  return {
    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description:
        'Request a governed stage transition for the Factory work item exactly bound to this thread. Use the current revision from the factory-phase signal and explain why the transition is appropriate.',
      inputSchema: transitionInputSchema,
      execute: async ({ stage, expectedRevision, rationale }, execution) => {
        const currentAddress = getFactorySessionAddress(execution.requestContext);
        const toolCallId = execution.agent?.toolCallId;
        if (!currentAddress || !toolCallId) {
          throw new Error('Factory transitions require an authenticated bound agent tool call.');
        }
        const binding = await options.storage.findActiveRunBinding(currentAddress);
        if (!binding || binding.id !== availableBinding.id) {
          throw new Error('Factory agent binding is unavailable, revoked, or no longer matches this session.');
        }
        const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (!item) throw new Error('Bound Factory work item not found.');

        return options.transitionService.transition({
          orgId: binding.orgId,
          factoryProjectId: binding.factoryProjectId,
          workItemId: binding.workItemId,
          board: boardForSource(item.externalSource?.type),
          stage,
          expectedRevision,
          actor: { type: 'agent', bindingId: binding.id, role: binding.role },
          ingress: { type: 'agent', identity: `${binding.id}:${toolCallId}` },
          cause: rationale,
        });
      },
    }),
  };
}
