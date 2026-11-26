import type { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import {
  boardFlow,
  boardForWorkItem,
  cardBoardFlow,
  hasPullRequest,
  isPullRequestCard,
  reviewedChangeRequest,
  workItemPhaseSemantics,
} from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { PHASE_OUTCOME_METADATA_KEY, phaseOutcomes } from '../boards/phase-outcomes.js';
import type { ReportedPhaseOutcome } from '../boards/phase-outcomes.js';
import { toBoardSource } from '../boards/project-boards.js';
import type { ProjectBoardSource } from '../boards/project-boards.js';
import type { IntegrationTools } from '../integrations/base.js';
import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { Card, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { FactorySessionSourceLookup } from './binding-context.js';
import { resolveFactorySessionAddress, setFactoryToolsRole } from './binding-context.js';
import { phaseGrantsTool } from './phase-tools.js';
import { SELF_REVIEW_ROUND_LIMIT, workItemSource } from './types.js';
import { BOARD_IDENTIFIER_RE, MAX_BOARD_IDENTIFIER_LENGTH } from './validation.js';

const MAX_REASON_LENGTH = 1_000;

// Providers strip maxLength from the JSON schema and models can't count characters, so a hard
// cap invites overshoot-retry loops at the end of every run. Accept and clamp instead.
const clampedReason = z
  .string()
  .trim()
  .min(1)
  .transform(value => (value.length <= MAX_REASON_LENGTH ? value : `${value.slice(0, MAX_REASON_LENGTH - 1)}…`));

const reportOutcomeInputSchema = z
  .object({
    outcome: z
      .string()
      .max(MAX_BOARD_IDENTIFIER_LENGTH)
      .regex(BOARD_IDENTIFIER_RE)
      .describe('One of the outcome keys the factory-phase signal lists for the current phase.'),
    reason: clampedReason.describe('One or two sentences on why the phase ended this way.'),
  })
  .strict();

export async function createFactoryOutcomeTools(options: {
  requestContext: RequestContext;
  storage: WorkItemsStorage;
  sessions?: FactorySessionSourceLookup;
  boards?: BoardRegistry | ProjectBoardSource;
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
      if (
        item &&
        workItemPhaseSemantics(await toBoardSource(options.boards).load(retired), item)?.kind === 'terminal'
      ) {
        return { factory_report_outcome: createRetiredSessionTool(retired.workItemId, item.stages[0]) };
      }
    }
    return {};
  }
  setFactoryToolsRole(options.requestContext, availableBinding.role);
  // Tools are built for every turn, so a card that moves on takes its phase's tools with it.
  // A failed lookup grants no phase tools but keeps the outcome tool.
  const recordsVerdict = await options.storage
    .get({ orgId: availableBinding.orgId, id: availableBinding.workItemId })
    .then(item =>
      item ? phaseGrantsTool(options.boards, availableBinding, item, 'factory_record_review_verdict') : false,
    )
    .catch(() => false);

  return {
    ...(recordsVerdict ? createReviewVerdictTool(options, availableBinding.workItemId) : {}),
    factory_report_outcome: createTool({
      id: 'factory_report_outcome',
      description:
        "Report how the current phase of the Factory card bound to this thread ended, as one of the outcome keys the factory-phase signal lists. Factory moves the card to that outcome's phase once this run ends; you never move the card yourself. Report again to change it before the run ends.",
      inputSchema: reportOutcomeInputSchema,
      requireApproval: false,
      execute: async ({ outcome, reason }, execution) => {
        const currentResolution = await resolveFactorySessionAddress({
          requestContext: execution.requestContext,
          storage: options.storage,
          sessions: options.sessions,
        });
        const currentAddress = currentResolution?.address ?? null;
        if (!currentAddress || !execution.agent?.toolCallId) {
          throw new Error('Factory outcomes require an authenticated bound agent tool call.');
        }
        const binding = await options.storage.findActiveRunBinding(currentAddress);
        // Authority is the work item this session is bound to, not the individual binding row:
        // handing the next role its turn rotates the binding while this turn's tools stay live.
        // Re-pointing a session at a different item is the hijack this guards against.
        if (!binding || binding.workItemId !== availableBinding.workItemId) {
          throw new Error('Factory agent binding is unavailable, revoked, or no longer matches this session.');
        }
        const boards = await toBoardSource(options.boards).load(binding);
        for (let attempt = 1; ; attempt++) {
          const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
          if (!item) throw new Error('Bound Factory work item not found.');
          const stage = item.stages.length === 1 ? item.stages[0]! : undefined;
          const board = boards.get(boardForWorkItem(item));
          const phase = stage === undefined ? undefined : board?.phases[stage];
          if (!board || stage === undefined || phase?.kind !== 'working' || phase.runner.context !== binding.role) {
            throw new Error(
              `This session does not work the card in its current phase (${item.stages.join(', ')}), so it has no outcome to report.`,
            );
          }
          const allowed = phaseOutcomes(board, stage);
          const declared = allowed.find(candidate => candidate.key === outcome);
          if (!declared) {
            throw new Error(
              `${phase.name} has no outcome "${outcome}"; report one of: ${allowed.map(candidate => candidate.key).join(', ')}.`,
            );
          }
          const stamp: ReportedPhaseOutcome = {
            phase: stage,
            outcome: declared.key,
            to: declared.to,
            reason,
            source: 'reported',
            at: new Date().toISOString(),
            bindingId: binding.id,
          };
          try {
            await options.storage.update({
              orgId: binding.orgId,
              id: item.id,
              userId: `agent:${binding.id}`,
              expectedRevision: item.revision,
              patch: { metadata: { [PHASE_OUTCOME_METADATA_KEY]: stamp } },
            });
          } catch (error) {
            // Something else wrote the card; read it again and report on what it is now.
            if (error instanceof WorkItemUpdateConflictError && attempt < 3) continue;
            throw error;
          }
          return {
            status: 'reported',
            outcome: declared.key,
            label: declared.label,
            to: board.phases[declared.to]?.name ?? declared.to,
            note: 'Factory moves the card once this run ends. Finish your reply, then stop.',
          };
        }
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
    sessions?: FactorySessionSourceLookup;
    boards?: BoardRegistry | ProjectBoardSource;
  },
  boundWorkItemId: string,
): IntegrationTools {
  return {
    factory_record_review_verdict: createTool({
      id: 'factory_record_review_verdict',
      description:
        'Record the review verdict and the head SHA it covers on the card bound to this thread, ending the review pass. In the phase that reviews pull requests it records the published PR verdict and the card stays put. In a self-review phase with no change request open yet, approve keeps the card in place for you to open the change request from the approved head; once a GitHub pull request opens from that head, Factory moves the card to pull request review itself (elsewhere, report that outcome with factory_report_outcome). Request changes is the outcome of the phase: Factory sends the card back to the build phase with your findings once this run ends.',
      inputSchema: reviewVerdictInputSchema,
      requireApproval: false,
      execute: async ({ verdict, reviewedHeadSha, findings }, execution) => {
        const resolution = await resolveFactorySessionAddress({
          requestContext: execution.requestContext,
          storage: options.storage,
          sessions: options.sessions,
        });
        const binding = resolution ? await options.storage.findActiveRunBinding(resolution.address) : null;
        if (!binding || binding.workItemId !== boundWorkItemId) {
          throw new Error('Factory review binding is unavailable, revoked, or no longer matches this session.');
        }
        const item = await options.storage.get({ orgId: binding.orgId, id: binding.workItemId });
        if (!item) throw new Error('Bound Factory work item not found.');
        // The card may have moved since the tools were built for this turn.
        if (!(await phaseGrantsTool(options.boards, binding, item, 'factory_record_review_verdict'))) {
          throw new Error(
            `This session does not review the card in its current phase (${item.stages.join(', ')}); it cannot record a verdict.`,
          );
        }
        const boards = await toBoardSource(options.boards).load(binding);
        const boardId = boardForWorkItem(item);
        const board = boards.get(boardId);
        const flow = boardFlow(board);
        const stage = item.stages[0];
        const source = workItemSource(item.externalSource);
        const pullRequestCard = isPullRequestCard({ source });
        if (
          board &&
          stage === flow.selfReview &&
          !pullRequestCard &&
          typeof item.metadata?.openPullRequestNumber !== 'number'
        ) {
          return recordSelfReviewVerdict({
            storage: options.storage,
            binding,
            item,
            board: boardId,
            // Requested changes go back to the builder; a board without a build phase rests the card.
            buildPhase: flow.build ?? board.initialPhase,
            parkPhase: board.initialPhase,
            verdict,
            reviewedHeadSha: reviewedHeadSha.toLowerCase(),
            findings,
            toolCallId: execution.agent?.toolCallId,
          });
        }
        if (
          stage === undefined ||
          stage !== flow.pullRequestReview ||
          !hasPullRequest({ source, workItem: item.workItem })
        ) {
          const where = flow.pullRequestReview
            ? (board?.phases[flow.pullRequestReview]?.name ?? flow.pullRequestReview)
            : undefined;
          throw new Error(
            where
              ? `Only a card with a pull request in ${where} records a verdict; this one is in ${item.stages.join(', ')}.`
              : `The ${board?.name ?? boardId} board reviews no pull requests, so this card in ${item.stages.join(', ')} records no verdict.`,
          );
        }
        // An issue card can carry several pull requests; the verdict names the one it covers.
        const reviewedNumber = reviewedChangeRequest({ ...item, source })?.number;
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
                ...(reviewedNumber !== undefined ? { reviewedPullRequestNumber: reviewedNumber } : {}),
              },
            },
          });
        } catch (error) {
          if (!(error instanceof WorkItemUpdateConflictError)) throw error;
          throw new Error(
            'The Review card changed while recording the verdict; call again to record it on the current card.',
          );
        }
        // Mirror the verdict onto the card that authored the PR, so its
        // builder cannot close the work while changes are still requested.
        const parent = item.parentWorkItemId
          ? await options.storage.get({ orgId: binding.orgId, id: item.parentWorkItemId })
          : null;
        if (parent && cardBoardFlow(boards, parent).build !== undefined) {
          await options.storage.update({
            orgId: binding.orgId,
            id: parent.id,
            userId: `agent:${binding.id}`,
            patch: {
              metadata: {
                reviewVerdict: verdict,
                reviewedHeadSha: reviewedHeadSha.toLowerCase(),
                reviewedAt,
                ...(reviewedNumber !== undefined ? { reviewedPullRequestNumber: reviewedNumber } : {}),
              },
            },
          });
        }
        return { status: 'recorded', verdict, reviewedHeadSha, reviewedAt };
      },
    }),
  };
}

/**
 * Self-review ends the same way a PR review does, but on the authoring card before
 * any change request exists, and requesting changes is its outcome: the verdict
 * alone decides where the work goes next, and Factory moves the card there once
 * the run ends.
 */
async function recordSelfReviewVerdict(input: {
  storage: WorkItemsStorage;
  binding: { id: string; orgId: string; factoryProjectId: string; workItemId: string; role: string };
  item: Card;
  board: string;
  buildPhase: string;
  parkPhase: string;
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
  // Every SELF_REVIEW_ROUND_LIMIT rounds the card rests in its board's initial phase for a person
  // instead of looping; moving it back to the build phase grants another full set of rounds.
  const parked = verdict === 'request changes' && rounds % SELF_REVIEW_ROUND_LIMIT === 0;
  const stage = item.stages[0]!;
  const outcome: ReportedPhaseOutcome | undefined =
    verdict === 'request changes'
      ? {
          phase: stage,
          outcome: parked ? 'park' : 'request-changes',
          to: parked ? input.parkPhase : input.buildPhase,
          reason: parked
            ? `Self-review requested changes ${rounds} times; parked for a person to decide how to proceed.`
            : `Self-review requested changes on ${reviewedHeadSha} (round ${rounds}).`,
          source: 'verdict',
          at: reviewedAt,
          bindingId: binding.id,
        }
      : undefined;
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
          ...(outcome ? { [PHASE_OUTCOME_METADATA_KEY]: outcome } : {}),
        },
      },
    });
  } catch (error) {
    if (!(error instanceof WorkItemUpdateConflictError)) throw error;
    throw new Error('The card changed while recording the verdict; call again to record it on the current card.');
  }
  if (!updated) throw new Error('Bound Factory work item not found.');
  if (!outcome) return { status: 'recorded', verdict, reviewedHeadSha, reviewedAt, selfReviewRounds: rounds };
  return {
    status: 'recorded',
    verdict,
    reviewedHeadSha,
    reviewedAt,
    selfReviewRounds: rounds,
    note: `Factory moves the card to ${outcome.to} once this run ends.`,
  };
}

/**
 * A retired session's outcome tool: it exists only to fail loudly. The run's
 * binding was revoked when its work item settled at a terminal stage, so there
 * is no phase left to report on. Registering it (instead of dropping the tool)
 * stops a resumed model from inventing a false "blocked" state when the
 * affordance it expects has silently vanished.
 */
function createRetiredSessionTool(workItemId: string, stage: string | undefined): IntegrationTools[string] {
  return createTool({
    id: 'factory_report_outcome',
    description:
      'This Factory session has been retired: its work item already reached a terminal stage and the run binding was revoked. No outcome can be reported from this session.',
    inputSchema: reportOutcomeInputSchema,
    requireApproval: false,
    execute: async () => {
      throw new Error(
        `This Factory session has been retired: work item ${workItemId} reached a terminal stage${
          stage ? ` (${stage})` : ''
        } and its run binding was revoked. No outcome can be reported from this session.`,
      );
    },
  });
}
