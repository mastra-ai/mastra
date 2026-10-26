import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { boardForWorkItem, workItemPhaseSemantics } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { SELF_REVIEW_ROUND_LIMIT } from '../boards/work.js';
import type { IntegrationTools } from '../integrations/base.js';
import { externalSourceKey, WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
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
    ...(availableBinding.role === 'review' ? createReviewVerdictTool(options, availableBinding.workItemId) : {}),
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

export const REVIEW_VERDICTS = ['approve', 'request changes'] as const;

const MAX_SELF_REVIEW_FINDINGS_LENGTH = 20_000;

const reviewVerdictInputSchema = z.object({
  verdict: z.enum(REVIEW_VERDICTS),
  reviewedHeadSha: z
    .string()
    .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i, 'Use the full commit SHA of the reviewed head.'),
  findings: z
    .string()
    .trim()
    .min(1)
    .transform(value =>
      value.length <= MAX_SELF_REVIEW_FINDINGS_LENGTH
        ? value
        : `${value.slice(0, MAX_SELF_REVIEW_FINDINGS_LENGTH - 1)}…`,
    )
    .optional()
    .describe(
      'Self-review only: the findings and test report, in Markdown. On request changes the builder receives them; on approve they go in the change request body.',
    ),
});

/**
 * A review pass ends by recording its verdict on the card, which stays in
 * Reviewing: Done is reserved for the merge, and a verdict is not a lane. The
 * next push re-reviews from the recorded verdict.
 */
function createReviewVerdictTool(
  options: {
    requestContext: RequestContext;
    storage: WorkItemsStorage;
    transitionService: Pick<FactoryTransitionService, 'transition'>;
    sessions?: FactorySessionSourceLookup;
  },
  boundWorkItemId: string,
): IntegrationTools {
  return {
    factory_record_review_verdict: createTool({
      id: 'factory_record_review_verdict',
      description:
        'Record the review verdict and the head SHA it covers on the card bound to this thread, ending the review pass. On a Review card it records the published PR verdict and the card stays in Reviewing. On a Work card in Review with no change request open yet (self-review), approve keeps the card in Review and wakes the builder to open the change request; request changes sends it back to Building with your findings.',
      inputSchema: reviewVerdictInputSchema,
      requireApproval: false,
      execute: async ({ verdict, reviewedHeadSha, findings }, execution) => {
        const resolution = await resolveFactorySessionAddress({
          requestContext: execution.requestContext,
          storage: options.storage,
          sessions: options.sessions,
        });
        const binding = resolution ? await options.storage.findActiveRunBinding(resolution.address) : null;
        if (!binding || binding.workItemId !== boundWorkItemId || binding.role !== 'review') {
          throw new Error('Factory review binding is unavailable, revoked, or no longer matches this session.');
        }
        const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (!item) throw new Error('Bound Factory work item not found.');
        const pullRequestCard = item.externalSource?.type === 'pull-request';
        if (
          !pullRequestCard &&
          boardForWorkItem(item) === 'work' &&
          item.stages[0] === 'review' &&
          typeof item.metadata?.openPullRequestNumber !== 'number'
        ) {
          return recordSelfReviewVerdict({
            storage: options.storage,
            transitionService: options.transitionService,
            binding,
            item,
            verdict,
            reviewedHeadSha: reviewedHeadSha.toLowerCase(),
            findings,
            toolCallId: execution.agent?.toolCallId,
          });
        }
        if (!pullRequestCard || item.stages[0] !== 'review') {
          throw new Error(`Only a card in Reviewing records a verdict; this one is in ${item.stages.join(', ')}.`);
        }
        const reviewedAt = new Date().toISOString();
        // Revision-checked, so a merge that moves the card between the stage
        // check and this write fails the call instead of stamping a Done card.
        try {
          await options.storage.update({
            orgId: binding.orgId,
            id: item.id,
            userId: `agent:${binding.id}`,
            expectedRevision: item.revision,
            patch: {
              metadata: {
                ...(item.metadata ?? {}),
                reviewVerdict: verdict,
                reviewedHeadSha: reviewedHeadSha.toLowerCase(),
                reviewedAt,
              },
            },
          });
        } catch (error) {
          if (!(error instanceof WorkItemUpdateConflictError)) throw error;
          throw new Error(
            'The Review card changed while recording the verdict; call again to record it on the current card.',
          );
        }
        // Mirror the verdict onto the Work item that authored the PR, so its
        // builder cannot close the work while changes are still requested.
        const parent = item.parentWorkItemId
          ? await options.storage.get({ orgId: binding.orgId, id: item.parentWorkItemId })
          : null;
        if (parent && boardForWorkItem(parent) === 'work') {
          await options.storage.update({
            orgId: binding.orgId,
            id: parent.id,
            userId: `agent:${binding.id}`,
            patch: {
              metadata: { reviewVerdict: verdict, reviewedHeadSha: reviewedHeadSha.toLowerCase(), reviewedAt },
            },
          });
        }
        const sourceKey = externalSourceKey(item.externalSource);
        if (sourceKey) {
          await options.storage.recordSourceReview({
            orgId: binding.orgId,
            factoryProjectId: item.factoryProjectId,
            sourceKey,
            verdict,
            reviewedHeadSha: reviewedHeadSha.toLowerCase(),
            reviewedAt: new Date(reviewedAt),
          });
        }
        return { status: 'recorded', verdict, reviewedHeadSha, reviewedAt };
      },
    }),
  };
}

/**
 * Self-review ends the same way a PR review does, but on the Work card before
 * any change request exists, and it moves the card itself: the verdict is the
 * only thing that decides where the work goes next.
 */
async function recordSelfReviewVerdict(input: {
  storage: WorkItemsStorage;
  transitionService: Pick<FactoryTransitionService, 'transition'>;
  binding: { id: string; orgId: string; factoryProjectId: string; workItemId: string; role: string };
  item: WorkItemRow;
  verdict: (typeof REVIEW_VERDICTS)[number];
  reviewedHeadSha: string;
  findings: string | undefined;
  toolCallId: string | undefined;
}) {
  const { storage, binding, item, verdict, reviewedHeadSha, findings } = input;
  if (!input.toolCallId) throw new Error('Self-review verdicts require an authenticated bound agent tool call.');
  const reviewedAt = new Date().toISOString();
  const previousRounds = typeof item.metadata?.selfReviewRounds === 'number' ? item.metadata.selfReviewRounds : 0;
  const rounds = verdict === 'request changes' ? previousRounds + 1 : previousRounds;
  // Every SELF_REVIEW_ROUND_LIMIT rounds the card rests in Intake for a person instead of looping;
  // moving it back to Building grants another full set of rounds.
  const parked = verdict === 'request changes' && rounds % SELF_REVIEW_ROUND_LIMIT === 0;
  let updated: Awaited<ReturnType<WorkItemsStorage['update']>>;
  try {
    updated = await storage.update({
      orgId: binding.orgId,
      id: item.id,
      userId: `agent:${binding.id}`,
      expectedRevision: item.revision,
      patch: {
        metadata: {
          selfReviewVerdict: verdict,
          selfReviewedHeadSha: reviewedHeadSha,
          selfReviewedAt: reviewedAt,
          selfReviewFindings: findings ?? null,
          selfReviewRounds: rounds,
          selfReviewNeedsHuman: parked,
        },
      },
    });
  } catch (error) {
    if (!(error instanceof WorkItemUpdateConflictError)) throw error;
    throw new Error('The Work card changed while recording the verdict; call again to record it on the current card.');
  }
  if (!updated) throw new Error('Bound Factory work item not found.');
  if (verdict === 'approve')
    return { status: 'recorded', verdict, reviewedHeadSha, reviewedAt, selfReviewRounds: rounds };
  const transition = await input.transitionService.transition({
    orgId: binding.orgId,
    factoryProjectId: binding.factoryProjectId,
    workItemId: binding.workItemId,
    board: 'work',
    stage: parked ? 'intake' : 'execute',
    expectedRevision: updated.item.revision,
    actor: { type: 'agent', bindingId: binding.id, role: binding.role },
    ingress: { type: 'agent', identity: `${binding.id}:${input.toolCallId}` },
    cause: parked
      ? `Self-review requested changes ${rounds} times; parked for a person to decide how to proceed.`
      : `Self-review requested changes on ${reviewedHeadSha} (round ${rounds}).`,
  });
  return { status: 'recorded', verdict, reviewedHeadSha, reviewedAt, selfReviewRounds: rounds, transition };
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
