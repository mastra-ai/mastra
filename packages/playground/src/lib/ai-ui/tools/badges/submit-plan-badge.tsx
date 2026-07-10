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

export interface SubmitPlanBadgeProps {
  toolCallId: string;
  suspendPayload: SubmitPlanSuspendPayload;
  resultContent?: string;
}

type SubmitPlanStatus = SubmitPlanResumeData['action'] | 'failed';

const getResultStatus = (content: string | undefined): SubmitPlanStatus | undefined => {
  if (content?.startsWith('Plan approved')) return 'approved';
  if (content?.startsWith('Plan was not approved')) return 'rejected';
  if (content?.startsWith('Failed to submit plan')) return 'failed';
  return undefined;
};

export const SubmitPlanBadge = ({ toolCallId, suspendPayload, resultContent }: SubmitPlanBadgeProps) => {
  const [submittedAction, setSubmittedAction] = useState<SubmitPlanResumeData['action']>();

  const { path, title, plan } = suspendPayload;
  const planContent = typeof plan === 'string' && plan.trim().length > 0 ? plan : undefined;
  const hasPlan = planContent !== undefined;
  const resolvedTitle = typeof title === 'string' && title.trim().length > 0 ? title : 'Submitted plan';
  const isComplete = resultContent !== undefined || submittedAction !== undefined;
  const status = getResultStatus(resultContent) ?? submittedAction;
  const statusLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Failed';
  const statusVariant = status === 'approved' ? 'success' : 'error';
  const copyContent = [resolvedTitle, `File: ${path}`, ...(planContent ? [planContent] : [])].join('\n\n');

  return (
    <Plan data-testid="submit-plan-badge" className="mb-4">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          {status && <PlanStatus variant={statusVariant}>{statusLabel}</PlanStatus>}
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
              hasPlan={hasPlan}
              onActionChange={setSubmittedAction}
            />
          )}
          {isComplete && hasPlan && <PlanControls />}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
};
