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
  PlanTitle,
} from '../../../ds/components/ai/plan';
import { Button } from '../../../ds/components/Button';
import { Skeleton } from '../../../ds/components/Skeleton';
import { Txt } from '../../../ds/components/Txt';
import { getPlanDocument } from './plan-document';

export interface SubmittedPlan {
  title: string;
  path?: string;
  content: string;
}

export function SubmittedPlanCard({ plan }: { plan: SubmittedPlan }) {
  const document = getPlanDocument(plan.content);

  return (
    <Plan role="group" aria-label="Submitted plan">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
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
          <PlanControls />
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}

export interface PendingPlanCardProps {
  path: string;
  content?: string;
  isLoading?: boolean;
  isError?: boolean;
  isRunning?: boolean;
  isAnswered?: boolean;
  onApprove?: () => void;
  onReject?: () => void;
}

export function PendingPlanCard({
  path,
  content,
  isLoading,
  isError,
  isRunning,
  isAnswered,
  onApprove,
  onReject,
}: PendingPlanCardProps) {
  const document = content ? getPlanDocument(content) : undefined;
  const controlsDisabled = isLoading || isRunning || isAnswered;
  return (
    <Plan role="group" aria-label="Plan approval">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>{content !== undefined ? <PlanCopyButton content={content} /> : null}</PlanHeaderActions>
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
            <Txt as="p" variant="ui-sm" className="text-neutral4">
              Unable to load the submitted plan.
            </Txt>
          ) : null}
          {document ? <PlanContent>{document.body}</PlanContent> : null}
          <PlanControls>
            <PlanActionGroup>
              {onApprove && (
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  aria-label="Approve the plan and switch to build"
                  className="shrink-0 whitespace-nowrap"
                  disabled={controlsDisabled}
                  onClick={() => onApprove()}
                >
                  Approve &amp; build
                </Button>
              )}
            </PlanActionGroup>
            <span className="flex justify-center">
              <PlanExpandButton />
            </span>
            <PlanActionGroup>
              {onReject && (
                <Button
                  type="button"
                  size="sm"
                  aria-label="Reject the plan"
                  disabled={controlsDisabled}
                  onClick={() => onReject()}
                >
                  Reject
                </Button>
              )}
            </PlanActionGroup>
          </PlanControls>
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}
