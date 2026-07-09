import {
  Plan,
  PlanActionGroup,
  PlanBody,
  PlanContent,
  PlanControls,
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
} from '@mastra/playground-ui/components/ai/plan';
import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { CheckIcon, MessageSquareText, XIcon } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { SubmitPlanResult, SubmitPlanResumeData, SubmitPlanSuspendPayload } from './types';
import { useToolCall } from '@/services/tool-call-provider';

export interface SubmitPlanBadgeProps {
  toolCallId: string;
  suspendPayload: SubmitPlanSuspendPayload;
  result: SubmitPlanResult | undefined;
}

type SubmitPlanStatus = SubmitPlanResumeData['action'] | 'resolved';

const getSubmitPlanStatus = (result: SubmitPlanResult | undefined): SubmitPlanStatus | undefined => {
  if (!result) return undefined;
  if (result.action === 'approved' || result.action === 'rejected') return result.action;
  if (result.content.startsWith('Plan approved')) return 'approved';
  if (result.content.startsWith('Plan was not approved')) return 'rejected';
  return 'resolved';
};

export const SubmitPlanBadge = ({ toolCallId, suspendPayload, result }: SubmitPlanBadgeProps) => {
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const [feedback, setFeedback] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const { path, title, plan } = suspendPayload;
  const planContent = typeof plan === 'string' && plan.length > 0 ? plan : undefined;
  const hasPlan = planContent !== undefined;
  const missingPlanMessage = `Could not read the plan file at \`${path}\`. Make sure the agent writes the markdown file before submitting it.`;
  const resolvedTitle = hasPlan ? (title ?? 'Submitted plan') : 'Plan file unavailable';
  const trimmedFeedback = feedback.trim();
  const isResolved = !!result || toolCallApprovals?.[toolCallId]?.status === 'approved';
  const status = getSubmitPlanStatus(result);
  const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Resolved';
  const statusVariant = status === 'approved' ? 'success' : status === 'rejected' ? 'error' : 'default';
  const displayPlan = planContent ?? missingPlanMessage;

  const sharedResumeData = useMemo(
    () => ({
      path,
      ...(title !== undefined ? { title } : {}),
      ...(plan !== undefined ? { plan } : {}),
    }),
    [path, plan, title],
  );

  const copyContent = useMemo(
    () =>
      [resolvedTitle, `File: ${path}`, displayPlan]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('\n\n'),
    [displayPlan, path, resolvedTitle],
  );

  const buildResumeData = useCallback(
    (action: SubmitPlanResumeData['action'], feedbackValue?: string): SubmitPlanResumeData => ({
      action,
      ...sharedResumeData,
      ...(feedbackValue ? { feedback: feedbackValue } : {}),
    }),
    [sharedResumeData],
  );

  const handleApprove = useCallback(() => {
    if (isResolved || isRunning) return;
    approveToolcall(toolCallId, buildResumeData('approved'));
  }, [approveToolcall, buildResumeData, isResolved, isRunning, toolCallId]);

  const handleReject = useCallback(() => {
    if (isResolved || isRunning) return;
    approveToolcall(toolCallId, buildResumeData('rejected'));
  }, [approveToolcall, buildResumeData, isResolved, isRunning, toolCallId]);

  const handleRequestChanges = useCallback(() => {
    if (isResolved || isRunning || !trimmedFeedback) return;
    approveToolcall(toolCallId, buildResumeData('rejected', trimmedFeedback));
  }, [approveToolcall, buildResumeData, isResolved, isRunning, toolCallId, trimmedFeedback]);

  const leftActions = !isResolved ? (
    <Button
      type="button"
      variant="primary"
      size="icon-sm"
      tooltip="Reject plan"
      aria-label="Reject plan"
      onClick={handleReject}
      disabled={isRunning}
    >
      <XIcon />
    </Button>
  ) : undefined;

  const rightActions = !isResolved ? (
    <>
      <Popover open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="primary"
            size="icon-sm"
            tooltip="Request changes"
            aria-label="Open request changes"
            aria-pressed={isFeedbackOpen}
            disabled={isRunning}
          >
            <MessageSquareText />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" sideOffset={8} className="w-72 p-3">
          <Textarea
            placeholder="Describe requested changes..."
            value={feedback}
            onChange={event => setFeedback(event.target.value)}
            disabled={isRunning}
            rows={3}
            variant="outline"
            size="sm"
            className="min-h-20 resize-y rounded-lg bg-surface1"
          />
          <div className="mt-2 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleRequestChanges}
              disabled={isRunning || !trimmedFeedback}
            >
              Request changes
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {hasPlan && (
        <Button
          type="button"
          variant="primary"
          size="icon-sm"
          tooltip="Approve plan"
          aria-label="Approve plan"
          onClick={handleApprove}
          disabled={isRunning}
        >
          <CheckIcon />
        </Button>
      )}
    </>
  ) : undefined;

  return (
    <Plan data-testid="submit-plan-badge" className="mb-4">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          {isResolved && <PlanStatus variant={statusVariant}>{statusLabel}</PlanStatus>}
          <PlanCopyButton content={copyContent} />
        </PlanHeaderActions>
      </PlanHeader>

      <PlanBody>
        <PlanIntro>
          <PlanTitle>{resolvedTitle}</PlanTitle>
          <PlanPath>{path}</PlanPath>
        </PlanIntro>

        <PlanMain>
          <PlanContent data-testid="submit-plan-content">{displayPlan}</PlanContent>
          {isResolved ? (
            <PlanControls />
          ) : (
            <PlanControls>
              <PlanActionGroup className="justify-end">{leftActions}</PlanActionGroup>
              <PlanExpandButton />
              <PlanActionGroup>{rightActions}</PlanActionGroup>
            </PlanControls>
          )}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
};
