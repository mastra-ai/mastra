import type { SubmitPlanResumeData, SubmitPlanSuspendPayload } from '@mastra/core/tools';
import { PlanActionGroup, PlanControls, PlanExpandButton } from '@mastra/playground-ui/components/ai/plan';
import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverContent, PopoverTrigger } from '@mastra/playground-ui/components/Popover';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { CheckIcon, MessageSquareText, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useToolCall } from '@/services/tool-call-provider';

interface SubmitPlanControlsProps {
  toolCallId: string;
  suspendPayload: SubmitPlanSuspendPayload;
  hasPlan: boolean;
  onActionChange: (action: SubmitPlanResumeData['action'] | undefined) => void;
}

const createResumeData = (
  suspendPayload: SubmitPlanSuspendPayload,
  action: SubmitPlanResumeData['action'],
  feedback?: string,
): SubmitPlanResumeData => ({
  action,
  path: suspendPayload.path,
  ...(suspendPayload.title !== undefined ? { title: suspendPayload.title } : {}),
  ...(suspendPayload.plan !== undefined ? { plan: suspendPayload.plan } : {}),
  ...(feedback ? { feedback } : {}),
});

export const SubmitPlanControls = ({
  toolCallId,
  suspendPayload,
  hasPlan,
  onActionChange,
}: SubmitPlanControlsProps) => {
  const { approveToolcall, isRunning } = useToolCall();
  const [feedback, setFeedback] = useState('');
  const trimmedFeedback = feedback.trim();

  const submitDecision = async (action: SubmitPlanResumeData['action'], feedbackValue?: string) => {
    if (isRunning) return;

    onActionChange(action);
    try {
      await approveToolcall(toolCallId, createResumeData(suspendPayload, action, feedbackValue));
    } catch {
      onActionChange(undefined);
    }
  };

  return (
    <PlanControls>
      <PlanActionGroup className="justify-end">
        <Button
          type="button"
          variant="primary"
          size="icon-sm"
          tooltip="Reject plan"
          aria-label="Reject plan"
          onClick={() => void submitDecision('rejected')}
          disabled={isRunning}
        >
          <XIcon />
        </Button>
      </PlanActionGroup>

      {hasPlan ? <PlanExpandButton /> : <span aria-hidden="true" />}

      <PlanActionGroup>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="primary"
              size="icon-sm"
              tooltip="Request changes"
              aria-label="Request changes"
              disabled={isRunning}
            >
              <MessageSquareText />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={8} className="w-72 p-3">
            <Textarea
              aria-label="Requested changes"
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
                onClick={() => void submitDecision('rejected', trimmedFeedback)}
                disabled={isRunning || !trimmedFeedback}
              >
                Request changes
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="primary"
          size="icon-sm"
          tooltip="Approve plan"
          aria-label="Approve plan"
          onClick={() => void submitDecision('approved')}
          disabled={isRunning}
        >
          <CheckIcon />
        </Button>
      </PlanActionGroup>
    </PlanControls>
  );
};
