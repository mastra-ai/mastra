import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';
import type { FactoryTransitionService } from './transition-service.js';
import { currentStage } from './transition-service.js';
import { FACTORY_RULE_STAGES } from './types.js';
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

  return {
    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description:
        'Request a governed stage transition for the Factory work item exactly bound to this thread. Use the current revision from the factory-phase signal and explain why the transition is appropriate.',
      inputSchema: transitionInputSchema,
      requireApproval: true,
      execute: async ({ stage, expectedRevision, rationale }, execution) => {
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
        if (!binding || binding.id !== availableBinding.id) {
          throw new Error('Factory agent binding is unavailable, revoked, or no longer matches this session.');
        }
        const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (!item) throw new Error('Bound Factory work item not found.');

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
        });

        // A phase EXIT is the natural moment to ask what was worth keeping:
        // run the subconscious curator directly on the session's thread.
        // Fire-and-forget with contained errors — a curation failure must
        // never fail or delay the transition. Empty phases report no-op.
        // Cast because `memory` is runtime-present but absent from the public
        // tool execution context type; @mastra/memory is not a factory dep.
        const memory = (
          execution as {
            memory?: {
              runCuration?: (options: {
                threadId: string;
                resourceId: string;
                requestContext?: RequestContext;
                prompt?: string;
              }) => Promise<{ outcome: string }>;
            };
          }
        ).memory;
        if (memory?.runCuration && result.status === 'accepted') {
          // `stage` is the destination; the phase being LEFT is the item's stage
          // before the transition (captured from the pre-transition read above).
          const exitedStage = currentStage(item.stages) ?? stage;
          void (async () => {
            try {
              const threadId = execution.agent?.threadId;
              const resourceId = execution.agent?.resourceId;
              if (!threadId) return;
              const { outcome } = await memory.runCuration!({
                threadId,
                resourceId: resourceId ?? threadId,
                requestContext: execution.requestContext,
                prompt: `Now that the work item has left the ${exitedStage} phase: is there anything from this phase worth remembering — a durable project memory, or something worth pinning?`,
              });
              // Outcomes: ran | no-op (empty worklist) | skipped (in flight) | no-model.
              console.debug(
                `[factory:transition-curate] thread=${threadId} from=${exitedStage} to=${stage} outcome=${outcome}`,
              );
            } catch (error) {
              console.debug(
                `[factory:transition-curate] thread=${execution.agent?.threadId ?? 'unknown'} from=${exitedStage} to=${stage} failed: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          })();
        }

        return result;
      },
    }),
  };
}
