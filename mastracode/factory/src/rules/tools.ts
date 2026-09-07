import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';
import type { FactoryTransitionService } from './transition-service.js';
import { FACTORY_RULE_STAGES, FACTORY_TRIAGE_TYPES, isFactoryTriageType } from './types.js';
import type { FactoryRuleBoard } from './types.js';

const MAX_RATIONALE_LENGTH = 1_000;

const transitionInputSchema = z
  .object({
    stage: z.enum(FACTORY_RULE_STAGES),
    expectedRevision: z.number().int().positive(),
    // Providers strip maxLength from the JSON schema and models can't count characters, so a
    // hard cap invites overshoot-retry loops at the end of every run. Accept and clamp instead.
    rationale: z
      .string()
      .trim()
      .min(1)
      .transform(value =>
        value.length <= MAX_RATIONALE_LENGTH ? value : `${value.slice(0, MAX_RATIONALE_LENGTH - 1)}…`,
      ),
  })
  .strict();

const triageTransitionInputSchema = transitionInputSchema.extend({
  triageType: z.enum(FACTORY_TRIAGE_TYPES),
});

function boardForSource(type: string | undefined): FactoryRuleBoard {
  return type === 'pull-request' ? 'review' : 'work';
}

export async function createFactoryTransitionTools(options: {
  requestContext: RequestContext;
  storage: WorkItemsStorage;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  sessions?: FactorySessionSourceLookup;
}): Promise<IntegrationTools> {
  const resolution = await resolveFactorySessionAddress({
    requestContext: options.requestContext,
    storage: options.storage,
    sessions: options.sessions,
  });
  if (!resolution) return {};
  const availableBinding = resolution.binding ?? (await options.storage.findActiveRunBinding(resolution.address));
  if (!availableBinding) return {};
  const isTriage = availableBinding.role === 'triage';

  return {
    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description: isTriage
        ? 'Report the triage classification and request a governed stage transition for the Factory work item exactly bound to this thread. Only bugs may request Planning autonomously; closure outcomes may request a terminal stage. Feature requests and other non-bug classifications that remain open must stay in their current Intake or Triage stage for maintainer approval.'
        : 'Request a governed stage transition for the Factory work item exactly bound to this thread. Use the current revision from the factory-phase signal and explain why the transition is appropriate.',
      inputSchema: isTriage ? triageTransitionInputSchema : transitionInputSchema,
      requireApproval: true,
      execute: async ({ stage, expectedRevision, rationale, ...input }, execution) => {
        const currentResolution = await resolveFactorySessionAddress({
          requestContext: execution.requestContext,
          storage: options.storage,
          sessions: options.sessions,
        });
        const currentAddress = currentResolution?.address ?? null;
        const toolCallId = execution.agent?.toolCallId;
        if (!currentAddress || !toolCallId) {
          throw new Error('Factory transitions require an authenticated bound agent tool call.');
        }
        const binding = await options.storage.findActiveRunBinding(currentAddress);
        // Authority is the work item this session is bound to, not the individual
        // binding row. Handing the next role its turn in an existing session
        // rotates the binding, and tools built for the previous role stay live
        // across that rotation; keying on row identity would strand the run that
        // the rotation exists to start. Re-pointing a session at a different item
        // is the hijack this guards against.
        if (!binding || binding.workItemId !== availableBinding.workItemId) {
          throw new Error('Factory agent binding is unavailable, revoked, or no longer matches this session.');
        }
        const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (!item) throw new Error('Bound Factory work item not found.');
        const triageType =
          'triageType' in input && isFactoryTriageType(input.triageType) ? input.triageType : undefined;

        const result = await options.transitionService.transition({
          orgId: binding.orgId,
          factoryProjectId: binding.factoryProjectId,
          workItemId: binding.workItemId,
          board: boardForSource(item.externalSource?.type),
          stage,
          expectedRevision,
          actor: { type: 'agent', bindingId: binding.id, role: binding.role },
          ingress: { type: 'agent', identity: `${binding.id}:${toolCallId}` },
          cause: rationale,
          ...(triageType ? { triageType } : {}),
        });

        return result;
      },
    }),
  };
}
