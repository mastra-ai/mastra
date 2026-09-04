import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { describeParkedTool, FACTORY_DISPATCH_CONSTANTS } from '../rules/dispatcher.js';
import type { AuditActorType, AuditStorage } from '../storage/domains/audit/base.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryParkedSuspension,
  FactoryRunBindingRecord,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';
import {
  decisionFailedFinding,
  decisionIdFromFindingKey,
  factoryHealthSubject,
  QUESTION_FAILURE_CODES,
} from './health.js';
import type { NotifySupervisorInput } from './notify.js';
import type { SupervisorScope } from './read-tools.js';
import { MAX_TEXT, truncateText } from './text.js';

/** What a resumed run does next, as the session reports it. */
export type ResumeBoundaryEvent =
  | { type: 'tool_suspended'; toolCallId: string; toolName: string; args?: unknown; suspendPayload?: unknown }
  | { type: 'agent_end'; reason: 'complete' | 'aborted' | 'error' | 'suspended' }
  | { type: 'error'; error: unknown }
  | { type: string };

/** The slice of a code-agent session an answer needs: is it still parked, resume it, and watch what follows. */
export interface SuspendableSession {
  suspensions: { has(input: { toolCallId: string }): boolean };
  /** Resolves when the resumed run reaches its next boundary: parks again, ends, or errors. */
  respondToToolSuspension(input: { resumeData: unknown; toolCallId?: string }): Promise<void>;
  subscribe(listener: (event: ResumeBoundaryEvent) => void): () => void;
}

/** How long an answer waits for the resumed run's next boundary before reporting it as proceeding. */
const RESUME_ACK_MS = 2_000;

/**
 * Who a supervisor turn is acting as. Authenticated turns carry the human's
 * user id; signal-woken turns carry the agent identity (`agent:<threadId>`),
 * following the audit trail's existing convention.
 */
export interface SupervisorActor {
  type: AuditActorType;
  id: string;
}

interface SupervisorActionDependencies {
  scope: SupervisorScope;
  actor: SupervisorActor;
  workItems: Pick<
    WorkItemsStorage,
    | 'escalateSupervisorFinding'
    | 'getDeferredDecision'
    | 'listRunBindings'
    | 'resolveAnsweredDecision'
    | 'reparkDecision'
    | 'openSupervisorFinding'
    | 'get'
  >;
  audit: Pick<AuditStorage, 'record'>;
  /** Session lookup by resource id, the join key persisted with a parked suspension. */
  controller: { getSessionByResource(resourceId: string): Promise<SuspendableSession | undefined> };
  /** Rings the supervisor when an answered run parks on a new question. */
  notifySupervisor?: (input: NotifySupervisorInput) => Promise<void>;
  logger?: { warn: (message: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
  /** Test seam for {@link RESUME_ACK_MS}. */
  resumeAckMs?: number;
}

/**
 * Supervisor tools that are deliberately approval-free: they are how the
 * supervisor reaches a human (escalate) or acts on a human's behalf without
 * putting that human back in the loop. Guardrails are the audit trail and the
 * supervisor's instructions, not an approval prompt. These register on both
 * authenticated and signal-woken turns.
 */
export function createFactorySupervisorActionTools(deps: SupervisorActionDependencies): IntegrationTools {
  const now = deps.now ?? (() => new Date());
  const audit = async (action: string, target: { type: string; id: string }, metadata: Record<string, unknown> = {}) =>
    deps.audit.record({
      orgId: deps.scope.orgId,
      actorId: deps.actor.id,
      actorType: deps.actor.type,
      action,
      targets: [target],
      factoryProjectId: deps.scope.factoryProjectId,
      metadata: { ...metadata, cause: 'supervisor' },
      occurredAt: now(),
    });

  // Mutations land before their audit row. An audit failure must not read as
  // "the action failed" (a retry would repeat an irreversible action), so the
  // outcome is reported alongside; the raw storage error stays in the log.
  const auditAfter = async <Field extends string>(
    field: Field,
    action: string,
    target: { type: string; id: string },
    metadata: Record<string, unknown>,
  ): Promise<Record<Field, boolean> & { auditError?: string }> => {
    try {
      await audit(action, target, metadata);
      return { [field]: true } as Record<Field, boolean>;
    } catch (error) {
      deps.logger?.warn(`Factory supervisor audit failed: ${action}`, {
        target,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        [field]: false,
        auditError: 'Done, but recording the audit entry failed. Do not retry.',
      } as Record<Field, boolean> & { auditError: string };
    }
  };

  /**
   * What an answered run did next, recorded on its decision so the finding
   * keeps telling the truth: completed → the decision succeeded and the next
   * sweep resolves the finding; parked again → the new question replaces the
   * old one and the supervisor is rung; failed → escalated to a person.
   */
  const settleResumedRun = async ({
    event,
    decision,
    binding,
    question,
    given,
    escalate,
  }: {
    event: ResumeBoundaryEvent | undefined;
    decision: FactoryDeferredDecisionRecord;
    binding: FactoryRunBindingRecord;
    question: string;
    given: string;
    escalate: (note: string) => Promise<Record<string, unknown>>;
  }): Promise<Record<string, unknown>> => {
    const tenant = { orgId: deps.scope.orgId, factoryProjectId: deps.scope.factoryProjectId, decisionId: decision.id };
    if (event?.type === 'tool_suspended' && 'toolCallId' in event) {
      const next = describeParkedTool(
        {
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          args: event.args,
          suspendPayload: event.suspendPayload,
        },
        binding,
      );
      const reparked = await deps.workItems.reparkDecision({
        ...tenant,
        suspension: next,
        lastError: `Factory run is waiting on ${next.toolName} for an answer.`,
        now: now(),
      });
      if (!reparked) {
        // The decision moved on underneath (superseded, dismissed): the parked
        // run is not this decision's to track any more. Say so, ring nothing.
        deps.logger?.warn('Factory supervisor answered run parked again, but its decision is no longer failed', {
          decisionId: decision.id,
        });
        return {
          run: 'parked-again',
          recorded: false,
          nextQuestion: next.question,
          note: 'The worker asked another question, but its decision is no longer open, so the question was not recorded.',
        };
      }
      // The finding is what a woken supervisor reads: refresh it with the
      // new question BEFORE ringing, through the same derivation the sweep
      // and the dispatcher use, so all three agree byte for byte.
      const item = reparked.workItemId
        ? await deps.workItems.get({ orgId: deps.scope.orgId, id: reparked.workItemId })
        : null;
      const finding = await deps.workItems.openSupervisorFinding({
        orgId: deps.scope.orgId,
        factoryProjectId: deps.scope.factoryProjectId,
        finding: decisionFailedFinding(reparked, factoryHealthSubject(reparked.workItemId, item ?? undefined), now()),
        now: now(),
      });
      try {
        await deps.notifySupervisor?.({
          projectId: deps.scope.factoryProjectId,
          findingKey: finding.findingKey,
          kind: 'decision-failed',
          summary: String(finding.finding.evidence ?? finding.findingKey),
          ...(reparked.failureCode ? { failureCode: reparked.failureCode } : {}),
          priority: 'high',
        });
      } catch (error) {
        deps.logger?.warn('Factory supervisor could not ring for a re-parked run', {
          decisionId: decision.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return {
        run: 'parked-again',
        recorded: true,
        nextQuestion: next.question,
        ...(next.options ? { nextOptions: next.options } : {}),
        note: 'The worker took the answer and asked another question; answer it the same way (same decision id).',
      };
    }
    if (event?.type === 'agent_end' && 'reason' in event && event.reason === 'complete') {
      const resolved = await deps.workItems.resolveAnsweredDecision({ ...tenant, now: now() });
      return resolved
        ? {
            run: 'completed',
            decisionStatus: resolved.status,
            note: 'The run finished; its finding clears at the next sweep.',
          }
        : {
            run: 'completed',
            decisionStatus: 'unchanged',
            note: 'The run finished; its decision had already moved on.',
          };
    }
    if (event?.type === 'agent_end' && 'reason' in event && event.reason === 'suspended') {
      return escalate(
        `The worker asked: ${question} The supervisor answered (${given}); the run then parked again on something the session did not describe. A person needs to look at the session.`,
      );
    }
    const error = event && 'error' in event ? event.error : undefined;
    deps.logger?.warn('Factory supervisor answer did not carry the run to completion', {
      decisionId: decision.id,
      boundary: event?.type,
      error: error instanceof Error ? error.message : error === undefined ? undefined : String(error),
    });
    return escalate(
      `The worker asked: ${question} The supervisor answered (${given}) but the run ${event?.type === 'error' ? 'failed while resuming' : 'ended without finishing'}; a person needs to look at the session.`,
    );
  };

  return {
    factory_escalate_finding: createTool({
      id: 'factory_escalate_finding',
      description:
        'Surface one open health finding to the humans on the Attention rail with a short note saying what you found and what you need from them. Use this when a finding needs a decision or information only a person has; it is the only way an open supervisor-actionable finding becomes visible to people before the backstop. Escalating the same finding again replaces the earlier note.',
      inputSchema: z.object({
        findingKey: z.string().min(1),
        note: z.string().trim().min(1).max(600),
      }),
      execute: async ({ findingKey, note }) => {
        const escalatedAt = now();
        const finding = await deps.workItems.escalateSupervisorFinding({
          orgId: deps.scope.orgId,
          factoryProjectId: deps.scope.factoryProjectId,
          findingKey,
          note,
          escalatedAt,
        });
        if (!finding) throw new Error('The finding is not open, no longer exists, or belongs to another factory.');
        // The escalation is the user-visible effect and has already landed.
        // An audit failure must not read as "escalation failed" (a retry
        // would only rewrite the note), so both outcomes are reported. The
        // raw storage error stays out of the model-visible result.
        let audited = true;
        try {
          await audit('factory.supervisor.finding_escalated', { type: 'supervisor_finding', id: findingKey }, { note });
        } catch (error) {
          audited = false;
          deps.logger?.warn('Factory supervisor escalation audit failed', {
            findingKey,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        return {
          findingKey,
          status: finding.status,
          escalatedAt: escalatedAt.toISOString(),
          note: finding.escalationNote,
          audited,
          ...(audited ? {} : { auditError: 'Escalated, but recording the audit entry failed. Do not retry.' }),
        };
      },
    }),

    factory_answer_suspension: createTool({
      id: 'factory_answer_suspension',
      description:
        'Answer a worker run that is parked on a question (a decision that failed with run_awaiting_input) and resume it. Give the decision id (or its decision-failed:<id> finding key) and your answer: for a question with options, the option text (a list of options when the question allows several); otherwise free text. Answer only when the answer is operational, reversible, or derivable from the factory context you can read. Product-shaped, destructive, or scope-changing questions, and any plan awaiting review, are escalated to a person instead: this tool escalates them for you rather than guessing, and never approves a plan. If the run was already answered or is no longer parked, it says so and changes nothing.',
      inputSchema: z.object({
        decisionId: z.string().min(1).optional(),
        findingKey: z.string().min(1).optional(),
        answer: z.union([
          z.string().trim().min(1).max(MAX_TEXT),
          z.array(z.string().trim().min(1).max(MAX_TEXT)).min(1).max(20),
        ]),
      }),
      execute: async ({ decisionId: givenId, findingKey, answer }) => {
        const fromKey = findingKey ? decisionIdFromFindingKey(findingKey) : undefined;
        if (givenId && findingKey && fromKey !== givenId) {
          throw new Error('decisionId and findingKey name different decisions; give one, or make them agree.');
        }
        const decisionId = givenId ?? fromKey;
        if (!decisionId) throw new Error('Give a decision id or a decision-failed:<id> finding key.');
        const key = `decision-failed:${decisionId}`;
        const given = Array.isArray(answer) ? answer.join(', ') : answer;
        // Scoped to this supervisor's own factory: another project's decision is simply not found.
        const decision = await deps.workItems.getDeferredDecision(
          deps.scope.orgId,
          deps.scope.factoryProjectId,
          decisionId,
        );
        if (!decision) throw new Error('No such decision in this factory.');
        if (
          decision.status !== 'failed' ||
          !decision.failureCode ||
          !QUESTION_FAILURE_CODES.has(decision.failureCode)
        ) {
          return {
            decisionId,
            outcome: 'not-parked' as const,
            reason: `The decision is ${decision.status}${decision.failureCode ? ` (${decision.failureCode})` : ''}, not parked on a question.`,
          };
        }

        const escalate = async (note: string) => {
          const escalatedAt = now();
          const bounded = truncateText(note);
          const finding = await deps.workItems.escalateSupervisorFinding({
            orgId: deps.scope.orgId,
            factoryProjectId: deps.scope.factoryProjectId,
            findingKey: key,
            note: bounded,
            escalatedAt,
          });
          if (!finding) {
            throw new Error(
              'Could not answer this, and its finding is not open to escalate; a person needs to look at the decision directly.',
            );
          }
          const audited = await auditAfter(
            'escalationAudited',
            'factory.supervisor.suspension_escalated',
            { type: 'deferred_decision', id: decisionId },
            { findingKey: key, note: bounded, answer },
          );
          return { decisionId, outcome: 'escalated' as const, findingKey: key, note: bounded, ...audited };
        };

        const parked = decision.suspension;
        if (!parked) {
          return escalate(
            'A worker run is parked on a question, but the question was recorded before questions were captured; a person needs to open the session and answer there.',
          );
        }
        if (parked.toolName === 'submit_plan') {
          return escalate(
            `The worker wrote a plan and it was not approved after ${FACTORY_DISPATCH_CONSTANTS.maxPlanApprovals} automatic approvals; a person should review it. Supervisor's read: ${given}`,
          );
        }
        if (parked.toolName !== 'ask_user') {
          return escalate(
            `The worker is parked on ${parked.toolName}, which the supervisor cannot answer on its own. Question: ${parked.question}. Supervisor's read: ${given}`,
          );
        }
        if (parked.optionsOmitted) {
          return escalate(
            `The worker asked: ${parked.question} It offered choices that could not be captured verbatim, so no answer can be matched to them; a person needs to answer from the session. Supervisor's read: ${given}`,
          );
        }
        const resumeData = askUserResumeData(parked, answer);
        if (resumeData === undefined) {
          return escalate(
            `The worker asked: ${parked.question} Offered: ${(parked.options ?? []).join(' | ')}. The supervisor's answer (${given}) is not one of the offered options, so nothing was submitted.`,
          );
        }

        // The persisted correlation must match the binding on record in full:
        // the binding must be this project's, still active, and the very
        // session/thread the question was captured in. Anything else is not a
        // run this answer can safely reach.
        const bindings = await deps.workItems.listRunBindings(deps.scope.orgId, deps.scope.factoryProjectId);
        const binding = bindings.find(candidate => candidate.id === parked.session.bindingId);
        if (!binding || binding.status !== 'active') {
          return escalate(
            `The worker asked: ${parked.question} but its run binding is ${binding ? binding.status : 'gone'}; the run cannot be resumed and needs a person to restart it.`,
          );
        }
        if (binding.resourceId !== parked.session.resourceId || binding.threadId !== parked.session.threadId) {
          return escalate(
            `The worker asked: ${parked.question} but the recorded session no longer matches its binding; a person needs to check the run before it is answered.`,
          );
        }

        const session = await deps.controller.getSessionByResource(binding.resourceId);
        // Not parked any more: a person answered from the session, or the
        // process restarted and the in-memory suspension is gone. Either way
        // a resume would be a no-op; say so rather than fail.
        if (!session || !session.suspensions.has({ toolCallId: parked.toolCallId })) {
          return {
            decisionId,
            outcome: 'already-handled' as const,
            reason: session
              ? 'The question is no longer parked in the worker session (already answered, or the process restarted since it was asked).'
              : 'The worker session is not reachable from this process.',
          };
        }
        // No await between the check above and this call: the session resolves
        // the suspension synchronously on entry, so nothing can take it in
        // between. The call itself settles at the resumed run's next boundary
        // (parks again, ends, or errors) — minutes, for a real run — so the
        // answer is acknowledged after a short wait and the boundary is
        // handled whenever it arrives, in the background if need be.
        const boundary = watchResumeBoundary(session);
        const resumed = session
          .respondToToolSuspension({ resumeData, toolCallId: parked.toolCallId })
          .then(
            () => boundary.first(),
            (error): ResumeBoundaryEvent => ({ type: 'error', error }),
          )
          .finally(() => boundary.stop());
        const settle = (event: ResumeBoundaryEvent | undefined) =>
          settleResumedRun({ event, decision, binding, question: parked.question, given, escalate });
        const first = await Promise.race([
          resumed,
          new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), deps.resumeAckMs ?? RESUME_ACK_MS)),
        ]);
        const audited = await auditAfter(
          'answerAudited',
          'factory.supervisor.suspension_answered',
          { type: 'deferred_decision', id: decisionId },
          { toolName: parked.toolName, toolCallId: parked.toolCallId, question: parked.question, answer: resumeData },
        );
        if (first === undefined) {
          void resumed.then(settle).catch(error => {
            deps.logger?.warn('Factory supervisor could not record how an answered run ended', {
              decisionId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
          return {
            decisionId,
            outcome: 'answered' as const,
            run: 'proceeding' as const,
            question: parked.question,
            answer: resumeData,
            ...audited,
            note: 'The run is going again; its finding clears when the run ends, or updates if it parks on another question.',
          };
        }
        const settled = await settle(first);
        return {
          decisionId,
          outcome: 'answered' as const,
          question: parked.question,
          answer: resumeData,
          ...audited,
          ...settled,
        };
      },
    }),
  };
}

/**
 * `ask_user` resumes with a string, or a list of strings for a multi-select.
 * With options offered, the answer must be among them (matched by exact text,
 * then case-insensitively); anything else is `undefined` — never submitted.
 */
function askUserResumeData(parked: FactoryParkedSuspension, answer: string | string[]): string | string[] | undefined {
  const given = Array.isArray(answer) ? answer : [answer];
  const options = parked.options;
  if (!options?.length) return Array.isArray(answer) ? answer.join('\n') : answer;
  const matched = given.map(
    text =>
      options.find(option => option === text) ?? options.find(option => option.toLowerCase() === text.toLowerCase()),
  );
  if (matched.some(option => option === undefined)) return undefined;
  const chosen = matched as string[];
  if (parked.selectionMode === 'multi_select') return chosen;
  return chosen.length === 1 ? chosen[0] : undefined;
}

/** Collects the first boundary event the session emits after a resume, until stopped. */
function watchResumeBoundary(session: SuspendableSession): {
  first(): ResumeBoundaryEvent | undefined;
  stop(): void;
} {
  let first: ResumeBoundaryEvent | undefined;
  const unsubscribe = session.subscribe(event => {
    if (first) return;
    if (event.type === 'tool_suspended' || event.type === 'agent_end' || event.type === 'error') first = event;
  });
  return { first: () => first, stop: unsubscribe };
}
