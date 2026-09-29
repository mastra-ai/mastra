import { Check, MessageSquareText, X } from 'lucide-react';
import { useState } from 'react';
import { useAgentPlan } from '@/domains/agents/hooks/use-agent-plan';
import type { MessageMetadata } from '@/domains/chat';
import { useToolCall } from '@/domains/chat/context/tool-call-context';
import {
  Plan,
  PlanBody,
  PlanContent,
  PlanCopyButton,
  PlanExpandButton,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanStatus,
  PlanTitle,
} from '@/ds/components/ai/plan';
import { Button } from '@/ds/components/Button';
import { Skeleton } from '@/ds/components/Skeleton';
import { Textarea } from '@/ds/components/Textarea';
import { Txt } from '@/ds/components/Txt';

export interface SubmitPlanToolProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, any>;
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

interface SubmittedPlan {
  title: string;
  path?: string;
  content: string;
  action?: 'approved' | 'rejected';
  feedback?: string;
}

interface PlanDocument {
  title: string;
  body: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function getPlanDocument(content: string): PlanDocument {
  const headingMatch = /^#\s+(.+)\r?$/m.exec(content);

  if (!headingMatch) {
    return { title: 'Plan', body: content };
  }

  const heading = headingMatch[0];
  const headingIndex = headingMatch.index;
  const body = `${content.slice(0, headingIndex)}${content.slice(headingIndex + heading.length)}`.trimStart();

  return { title: (headingMatch[1] ?? '').trim(), body };
}

function getSubmittedPlan(output: unknown): SubmittedPlan | undefined {
  if (!isRecord(output) || !isRecord(output.submittedPlan)) return undefined;

  const content = getString(output.submittedPlan.plan);
  if (!content) return undefined;

  const document = getPlanDocument(content);
  const action = output.submittedPlan.action;

  return {
    title: getString(output.submittedPlan.title) ?? document.title,
    path: getString(output.submittedPlan.path),
    content,
    action: action === 'approved' || action === 'rejected' ? action : undefined,
    feedback: getString(output.submittedPlan.feedback),
  };
}

function PlanDecision({ action, feedback }: Pick<SubmittedPlan, 'action' | 'feedback'>) {
  if (action === 'approved') return <PlanStatus variant="green">Approved</PlanStatus>;
  if (action !== 'rejected') return null;
  if (feedback) return <PlanStatus variant="orange">Changes requested</PlanStatus>;
  return <PlanStatus variant="red">Rejected</PlanStatus>;
}

function getSuspendedPlanPath(
  metadata: MessageMetadata | undefined,
  toolName: string,
  toolCallId: string,
): string | undefined {
  const payload = (metadata?.suspendedTools?.[toolName] ?? metadata?.suspendedTools?.[toolCallId])?.suspendPayload;
  if (!isRecord(payload)) return undefined;

  return getString(payload.path);
}

function SubmittedPlanCard({ plan }: { plan: SubmittedPlan }) {
  const document = getPlanDocument(plan.content);

  return (
    <Plan role="group" aria-label="Submitted plan">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          <PlanDecision action={plan.action} feedback={plan.feedback} />
          <PlanCopyButton content={plan.content} />
        </PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>{plan.title}</PlanTitle>
          {plan.path ? <PlanPath>{plan.path}</PlanPath> : null}
        </PlanIntro>
        <PlanMain>
          <PlanContent>{document.body}</PlanContent>
          <div data-slot="plan-controls" className="relative z-10 mt-4 flex items-center gap-2 empty:hidden">
            <PlanExpandButton variant="ghost" />
          </div>
          {plan.feedback ? (
            <div className="mt-5 space-y-3">
              <div role="separator" aria-orientation="horizontal" className="-mx-5 h-px bg-border/40" />
              <Txt as="p" variant="label" tone="muted" className="pt-1">
                Requested changes
              </Txt>
              <Txt as="p" variant="body-sm" tone="ink" className="whitespace-pre-wrap">
                {plan.feedback}
              </Txt>
            </div>
          ) : null}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}

interface PendingPlanCardProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, any>;
  toolCallId: string;
  path: string;
}

function PendingPlanCard({ agentId, agentVersionId, requestContext, toolCallId, path }: PendingPlanCardProps) {
  const { data, isLoading, isError } = useAgentPlan({ agentId, agentVersionId, requestContext, path });
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const content = data?.content;
  const document = content ? getPlanDocument(content) : undefined;
  const isAnswered = toolCallApprovals[toolCallId] !== undefined;
  const controlsDisabled = isLoading || isRunning || isAnswered;

  const [isRequestingChanges, setIsRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState('');
  const trimmedFeedback = feedback.trim();

  const resume = (action: 'approved' | 'rejected', feedback?: string) => {
    approveToolcall(toolCallId, {
      action,
      ...(feedback ? { feedback } : {}),
      path,
      ...(document ? { title: document.title, plan: content } : {}),
    });
  };

  return (
    <Plan role="group" aria-label="Plan approval">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>{data ? <PlanCopyButton content={data.content} /> : null}</PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>{document?.title ?? 'Plan'}</PlanTitle>
          <PlanPath>{path}</PlanPath>
        </PlanIntro>
        <PlanMain>
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading submitted plan">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : null}
          {isError ? (
            <Txt as="p" variant="caption" tone="muted">
              Unable to load the submitted plan.
            </Txt>
          ) : null}
          {document ? <PlanContent>{document.body}</PlanContent> : null}
          <div
            data-slot="plan-controls"
            className="relative z-10 mt-4 flex flex-wrap items-center justify-between gap-2"
          >
            <PlanExpandButton variant="ghost" />
            {isRequestingChanges ? null : (
              <div data-slot="plan-decisions" className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Button
                  icon={<X />}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 whitespace-nowrap"
                  aria-label="Reject the plan"
                  disabled={controlsDisabled}
                  onClick={() => resume('rejected')}
                >
                  Reject
                </Button>
                <Button
                  icon={<MessageSquareText />}
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 whitespace-nowrap"
                  aria-expanded={isRequestingChanges}
                  disabled={controlsDisabled}
                  onClick={() => setIsRequestingChanges(true)}
                >
                  Request changes
                </Button>
                <Button
                  icon={<Check />}
                  type="button"
                  size="sm"
                  variant="primary"
                  aria-label="Approve the plan"
                  className="shrink-0 whitespace-nowrap"
                  disabled={controlsDisabled}
                  onClick={() => resume('approved')}
                >
                  Approve
                </Button>
              </div>
            )}
          </div>
          {isRequestingChanges ? (
            <form
              className="mt-5 space-y-3"
              onSubmit={event => {
                event.preventDefault();
                if (trimmedFeedback) resume('rejected', trimmedFeedback);
              }}
            >
              <div role="separator" aria-orientation="horizontal" className="-mx-5 h-px bg-border/40" />
              <Textarea
                aria-label="Requested changes"
                placeholder="Describe what should change in the plan"
                value={feedback}
                disabled={controlsDisabled}
                onChange={event => setFeedback(event.target.value)}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setIsRequestingChanges(false);
                    setFeedback('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" disabled={controlsDisabled || !trimmedFeedback}>
                  Send feedback
                </Button>
              </div>
            </form>
          ) : null}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}

export function SubmitPlanTool({
  agentId,
  agentVersionId,
  requestContext,
  toolName,
  toolCallId,
  output,
  metadata,
}: SubmitPlanToolProps) {
  const submittedPlan = getSubmittedPlan(output);
  if (submittedPlan) return <SubmittedPlanCard plan={submittedPlan} />;

  const path = getSuspendedPlanPath(metadata, toolName, toolCallId);
  if (!path) return null;

  return (
    <PendingPlanCard
      agentId={agentId}
      agentVersionId={agentVersionId}
      requestContext={requestContext}
      toolCallId={toolCallId}
      path={path}
    />
  );
}
