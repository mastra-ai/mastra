import { Actions, Button, Card, CardText, LinkButton } from 'chat';
import type { CardElement } from 'chat';

import { clip, formatPlanDigestText, hasPlanSections, unreadablePlanText } from '../../tools/plan-digest.js';
import type { PlanDigest, PlanDigestResult } from '../../tools/plan-digest.js';

/** Approve buttons on plan cards: `factory_plan:approve:<sessionId>:<toolCallId>`. */
export const PLAN_APPROVE_ACTION_PREFIX = 'factory_plan:approve:';

/** Slack refuses a section over 3000 characters; stay well under it. */
const SECTION_LENGTH = 2800;
const SECTION_LENGTHS = {
  goal: 1200,
  scope: SECTION_LENGTH,
  risks: 1500,
  openQuestions: 1200,
  excerpt: SECTION_LENGTH,
};
/** How many phase names a card lists. */
const PHASE_COUNT = 15;

export function planApproveActionId(sessionId: string, toolCallId: string): string {
  return `${PLAN_APPROVE_ACTION_PREFIX}${sessionId}:${toolCallId}`;
}

/** The session and call an Approve button answers; `null` for any other action. */
export function parsePlanApproveActionId(actionId: string): { sessionId: string; toolCallId: string } | null {
  if (!actionId.startsWith(PLAN_APPROVE_ACTION_PREFIX)) return null;
  const rest = actionId.slice(PLAN_APPROVE_ACTION_PREFIX.length);
  const split = rest.indexOf(':');
  if (split <= 0 || split === rest.length - 1) return null;
  return { sessionId: rest.slice(0, split), toolCallId: rest.slice(split + 1) };
}

/** Which plan a card is about, and where its session is. */
export interface PlanCardTarget {
  sessionId: string;
  toolCallId: string;
  /** Who submitted it, e.g. "The work session for #12". */
  subject: string;
  sessionUrl?: string;
}

/** How a plan card's question was settled. */
export type PlanCardResolution =
  | { kind: 'approved'; by?: string }
  | { kind: 'changes-requested' }
  /** The call is no longer waiting: answered elsewhere, or its run ended. */
  | { kind: 'stale' };

function planTitle(plan: PlanDigestResult): string {
  return plan.ok && plan.title ? clip(plan.title, 120) : 'Plan';
}

function planSections(plan: PlanDigest): CardElement['children'] {
  if (!hasPlanSections(plan)) {
    return plan.body ? [CardText(clip(plan.body, SECTION_LENGTHS.excerpt))] : [];
  }
  const phases = plan.phases.slice(0, PHASE_COUNT).map(name => `• ${clip(name, 160)}`);
  const morePhases = plan.phases.length - phases.length;
  return [
    ...(plan.goal ? [CardText(`**Goal**\n${clip(plan.goal, SECTION_LENGTHS.goal)}`)] : []),
    ...(plan.scope ? [CardText(`**Scope**\n${clip(plan.scope, SECTION_LENGTHS.scope)}`)] : []),
    ...(phases.length
      ? [CardText(`**Phases**\n${phases.join('\n')}${morePhases > 0 ? `\n• …and ${morePhases} more` : ''}`)]
      : []),
    ...(plan.risks ? [CardText(`**Risks**\n${clip(plan.risks, SECTION_LENGTHS.risks)}`)] : []),
    ...(plan.openQuestions
      ? [CardText(`**Open questions**\n${clip(plan.openQuestions, SECTION_LENGTHS.openQuestions)}`)]
      : []),
  ];
}

function openPlanLink(target: PlanCardTarget) {
  return target.sessionUrl ? [LinkButton({ url: target.sessionUrl, label: 'Open full plan' })] : [];
}

/**
 * The card a follower thread gets when a session parks on `submit_plan`: what
 * the plan says and a single Approve button. Changes are asked for by replying
 * in the thread. A plan that couldn't be read has no Approve button: nobody
 * approves a plan they can't see.
 */
export function planApprovalCard(plan: PlanDigestResult, target: PlanCardTarget): CardElement {
  const buttons = [
    ...(plan.ok
      ? [Button({ id: planApproveActionId(target.sessionId, target.toolCallId), label: 'Approve', style: 'primary' })]
      : []),
    ...openPlanLink(target),
  ];
  return Card({
    title: `📋 Plan ready for review: ${planTitle(plan)}`,
    children: [
      CardText(`${target.subject} submitted this plan and is waiting for approval.`, { style: 'muted' }),
      ...(plan.ok ? planSections(plan) : [CardText(unreadablePlanText(plan))]),
      ...(buttons.length ? [Actions(buttons)] : []),
      CardText(
        plan.ok
          ? 'Reply in this thread to request changes.'
          : 'Open the session to review and approve it, or reply in this thread to request changes.',
        { style: 'muted' },
      ),
    ],
  });
}

/** The card once its question is settled: no buttons left to click. */
export function planResolvedCard(
  plan: PlanDigestResult,
  target: PlanCardTarget,
  resolution: PlanCardResolution,
): CardElement {
  const title = planTitle(plan);
  const heading =
    resolution.kind === 'approved'
      ? `✅ Plan approved: ${title}`
      : resolution.kind === 'changes-requested'
        ? `✏️ Changes requested: ${title}`
        : `📋 Plan no longer waiting: ${title}`;
  const line =
    resolution.kind === 'approved'
      ? resolution.by
        ? `Approved by ${resolution.by}.`
        : 'Approved.'
      : resolution.kind === 'changes-requested'
        ? 'Changes were requested; the session is revising the plan.'
        : 'It was already answered, or its run is no longer waiting. Open the session to see where it stands.';
  const links = openPlanLink(target);
  return Card({
    title: heading,
    children: [CardText(line), ...(links.length ? [Actions(links)] : [])],
  });
}

/** Markdown for a thread that couldn't take the card: the plan, and where to approve it. */
export function planApprovalText(plan: PlanDigestResult, target: PlanCardTarget): string {
  return [
    `📋 **Plan ready for review: ${planTitle(plan)}**`,
    `${target.subject} submitted this plan and is waiting for approval.`,
    plan.ok ? formatPlanDigestText(plan) : unreadablePlanText(plan),
    target.sessionUrl
      ? `Approve it in the session: ${target.sessionUrl} — or reply in this thread to request changes.`
      : 'Approve it in the session, or reply in this thread to request changes.',
  ].join('\n\n');
}
