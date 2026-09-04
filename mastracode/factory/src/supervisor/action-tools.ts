import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import type { IntegrationTools } from '../integrations/base.js';
import { FACTORY_DISPATCH_CONSTANTS } from '../rules/dispatcher.js';
import type { AuditActorType, AuditStorage } from '../storage/domains/audit/base.js';
import type { FactoryParkedSuspension, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { decisionIdFromFindingKey, QUESTION_FAILURE_CODES } from './health.js';
import type { SupervisorScope } from './read-tools.js';

/** The slice of a code-agent session an answer needs: is it still parked, and resume it. */
export interface SuspendableSession {
  suspensions: { has(input: { toolCallId: string }): boolean };
  respondToToolSuspension(input: { resumeData: unknown; toolCallId?: string }): Promise<void>;
  subscribe(listener: (event: { type: string; error?: unknown }) => void): () => void;
}

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
  workItems: Pick<WorkItemsStorage, 'escalateSupervisorFinding' | 'getDeferredDecision' | 'listRunBindings'>;
  audit: Pick<AuditStorage, 'record'>;
  /** Session lookup by resource id, the join key persisted with a parked suspension. */
  controller: { getSessionByResource(resourceId: string): Promise<SuspendableSession | undefined> };
  logger?: { warn: (message: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
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
  const auditAfter = async (
    action: string,
    target: { type: string; id: string },
    metadata: Record<string, unknown>,
  ): Promise<{ audited: boolean; auditError?: string }> => {
    try {
      await audit(action, target, metadata);
      return { audited: true };
    } catch (error) {
      deps.logger?.warn(`Factory supervisor audit failed: ${action}`, {
        target,
        error: error instanceof Error ? error.message : String(error),
      });
      return { audited: false, auditError: 'Done, but recording the audit entry failed. Do not retry.' };
    }
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
        answer: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
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
          const finding = await deps.workItems.escalateSupervisorFinding({
            orgId: deps.scope.orgId,
            factoryProjectId: deps.scope.factoryProjectId,
            findingKey: key,
            note,
            escalatedAt,
          });
          if (!finding) {
            throw new Error(
              'Could not answer this, and its finding is not open to escalate; a person needs to look at the decision directly.',
            );
          }
          const audited = await auditAfter(
            'factory.supervisor.suspension_escalated',
            { type: 'deferred_decision', id: decisionId },
            { findingKey: key, note, answer },
          );
          return { decisionId, outcome: 'escalated' as const, findingKey: key, note, ...audited };
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
        // between. A resume that fails inside the run is swallowed by the
        // session (it emits an error and ends the run), so watch for that.
        let resumeError: unknown;
        const unsubscribe = session.subscribe(event => {
          if (event.type === 'error') resumeError = event.error;
        });
        try {
          await session.respondToToolSuspension({ resumeData, toolCallId: parked.toolCallId });
        } finally {
          unsubscribe();
        }
        if (resumeError !== undefined) {
          deps.logger?.warn('Factory supervisor answer did not resume the run', {
            decisionId,
            error: resumeError instanceof Error ? resumeError.message : String(resumeError),
          });
          return escalate(
            `The worker asked: ${parked.question} The supervisor answered (${given}) but the run failed while resuming; a person needs to look at the session.`,
          );
        }
        const audited = await auditAfter(
          'factory.supervisor.suspension_answered',
          { type: 'deferred_decision', id: decisionId },
          { toolName: parked.toolName, toolCallId: parked.toolCallId, question: parked.question, answer: resumeData },
        );
        return { decisionId, outcome: 'answered' as const, question: parked.question, answer: resumeData, ...audited };
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
