import type { SubmitPlanResumeData, SubmitPlanSuspendPayload } from '@mastra/core/tools';
import {
  Plan,
  PlanBody,
  PlanContent,
  PlanControls,
  PlanCopyButton,
  PlanFile,
  PlanHeader,
  PlanHeaderActions,
  PlanIntro,
  PlanLabel,
  PlanMain,
  PlanPath,
  PlanStatus,
  PlanTitle,
} from '@mastra/playground-ui/components/ai/plan';
import { useState } from 'react';
import { SubmitPlanControls } from './submit-plan-controls';

export type SubmitPlanStatus = SubmitPlanResumeData['action'] | 'failed';

export interface SubmitPlanBadgeProps {
  toolCallId: string;
  suspendPayload: SubmitPlanSuspendPayload;
  resultContent?: string;
  resultStatus?: SubmitPlanStatus;
}

const statusDetails: Record<SubmitPlanStatus, { label: string; variant: 'success' | 'error' }> = {
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'error' },
  failed: { label: 'Failed', variant: 'error' },
};

const getResultStatus = (content: string | undefined): SubmitPlanStatus | undefined => {
  if (content?.startsWith('Plan approved')) return 'approved';
  if (content?.startsWith('Plan was not approved')) return 'rejected';
  if (content?.startsWith('Failed to submit plan')) return 'failed';
  return undefined;
};

export const SubmitPlanBadge = ({ toolCallId, suspendPayload, resultContent, resultStatus }: SubmitPlanBadgeProps) => {
  const [submittedAction, setSubmittedAction] = useState<SubmitPlanResumeData['action']>();

  const { path, title, plan } = suspendPayload;
  const planContent = typeof plan === 'string' && plan.trim().length > 0 ? plan : undefined;
  const hasPlan = planContent !== undefined;
  const resolvedTitle = typeof title === 'string' && title.trim().length > 0 ? title : 'Submitted plan';
  const isComplete = resultContent !== undefined || resultStatus !== undefined || submittedAction !== undefined;
  const status = resultStatus ?? getResultStatus(resultContent) ?? submittedAction;
  const resolvedStatus = status ? statusDetails[status] : undefined;
  const copyContent = [resolvedTitle, `File: ${path}`, ...(planContent ? [planContent] : [])].join('\n\n');

  return (
    <Plan data-testid="submit-plan-badge" className="mb-4">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          {resolvedStatus && <PlanStatus variant={resolvedStatus.variant}>{resolvedStatus.label}</PlanStatus>}
          <PlanCopyButton content={copyContent} />
        </PlanHeaderActions>
      </PlanHeader>

      <PlanBody>
        <PlanIntro>
          <PlanTitle>{resolvedTitle}</PlanTitle>
          <PlanPath>{path}</PlanPath>
        </PlanIntro>

        <PlanMain>
          {hasPlan ? (
            <PlanContent data-testid="submit-plan-content">{planContent}</PlanContent>
          ) : (
            <PlanFile>{path}</PlanFile>
          )}

          {!isComplete && (
            <SubmitPlanControls
              toolCallId={toolCallId}
              suspendPayload={suspendPayload}
              onActionChange={setSubmittedAction}
            />
          )}
          {isComplete && hasPlan && <PlanControls />}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
};
