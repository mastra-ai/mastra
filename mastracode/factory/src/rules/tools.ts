import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem, workItemPhaseSemantics } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import type { IntegrationTools } from '../integrations/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress } from './binding-context.js';
import type { FactoryTransitionService } from './transition-service.js';
import { FACTORY_TRIAGE_TYPES } from './types.js';
import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from './validation.js';

const MAX_RATIONALE_LENGTH = 1_000;

const transitionInputSchema = z
  .object({
    stage: z.string().max(MAX_BOARD_IDENTIFIER_LENGTH).regex(BOARD_IDENTIFIER_RE),
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
    // Sessions are shared across role rotations, so a non-triage agent sees the triage
    // agent's earlier call (with triageType) in its history and copies the shape. Accept
    // the key here and drop it in execute rather than fail the whole call on it.
    triageType: z.enum(FACTORY_TRIAGE_TYPES).optional(),
  })
  .strict();

const triageTransitionInputSchema = transitionInputSchema.extend({
  triageType: z.enum(FACTORY_TRIAGE_TYPES),
});

export async function createFactoryTransitionTools(options: {
  requestContext: RequestContext;
  storage: WorkItemsStorage;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  sessions?: FactorySessionSourceLookup;
  boards?: BoardRegistry;
}): Promise<IntegrationTools> {
  const resolution = await resolveFactorySessionAddress({
    requestContext: options.requestContext,
    storage: options.storage,
    sessions: options.sessions,
  });
  if (!resolution) return {};
  const availableBinding = resolution.binding ?? (await options.storage.findActiveRunBinding(resolution.address));
  if (!availableBinding) {
    // No live binding for this session. A resumed session whose binding was
    // revoked when its work item reached a terminal stage was retired out from
    // under the model: rather than silently drop the tool — which leaves the
    // resumed run to rationalize a false blocked state — surface a tool that
    // fails with the concrete reason. Threads that were never bound (or whose
    // binding was rotated to a peer role, leaving the item still in flight) get
    // no tool as before.
    const retired = await options.storage.findRunBindingBySession(resolution.address);
    if (retired && retired.status === 'revoked' && options.boards) {
      const item = await options.storage.get({ orgId: retired.orgId, id: retired.workItemId });
      if (item && workItemPhaseSemantics(options.boards, item)?.kind === 'terminal') {
        return { factory_transition_work_item: createRetiredSessionTool(retired.workItemId, item.stages[0]) };
      }
    }
    return {};
  }
  let isTriage = false;
  if (availableBinding.role === 'triage') {
    const item = await options.storage.get({ orgId: availableBinding.orgId, id: availableBinding.workItemId });
    if (!item) return {};
    isTriage = boardForWorkItem(item) === 'work';
  }

  return {
    factory_transition_work_item: createTool({
      id: 'factory_transition_work_item',
      description: isTriage
        ? 'Report the triage classification and request a governed stage transition for the Factory work item exactly bound to this thread. Only bugs may request Planning autonomously; closure outcomes may request a terminal stage. Feature requests and other non-bug classifications that remain open must stay in their current Intake or Triage stage for maintainer approval.'
        : 'Request a governed stage transition for the Factory work item exactly bound to this thread. Use the current revision from the factory-phase signal and explain why the transition is appropriate.',
      inputSchema: isTriage ? triageTransitionInputSchema : transitionInputSchema,
      requireApproval: true,
      execute: async ({ stage, expectedRevision, rationale, triageType: requestedTriageType }, execution) => {
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
        const board = boardForWorkItem(item);
        // Only a Work triage binding may classify; other roles can echo the key from history.
        const triageType = board === 'work' && binding.role === 'triage' ? requestedTriageType : undefined;

        const result = await options.transitionService.transition({
          orgId: binding.orgId,
          factoryProjectId: binding.factoryProjectId,
          workItemId: binding.workItemId,
          board,
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

/**
 * A retired session's transition tool: it exists only to fail loudly. The run's
 * binding was revoked when its work item settled at a terminal stage, so there
 * is nothing to transition. Registering it (instead of dropping the tool) stops
 * a resumed model from inventing a false "blocked" state when the affordance it
 * expects has silently vanished.
 */
function createRetiredSessionTool(workItemId: string, stage: string | undefined): IntegrationTools[string] {
  return createTool({
    id: 'factory_transition_work_item',
    description:
      'This Factory session has been retired: its work item already reached a terminal stage and the run binding was revoked. No further transitions can be requested from this session.',
    inputSchema: transitionInputSchema,
    requireApproval: false,
    execute: async () => {
      throw new Error(
        `This Factory session has been retired: work item ${workItemId} reached a terminal stage${
          stage ? ` (${stage})` : ''
        } and its run binding was revoked. No transition can be requested from this session.`,
      );
    },
  });
}
