import type { PlanResume } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
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
} from '@mastra/playground-ui/components/ai/plan';

import { isPlanReadablePath, usePlanFile } from '../../../../hooks/use-fs';
import { useThreadWorkspacePath } from '../../workspace-viewer/hooks/useThreadWorkspacePath';
import { parsePlanMarkdown, resolveInlinePlan } from './submit-plan-source';

/**
 * The `submit_plan` approval and history card.
 *
 * Content resolution lives in `submit-plan-source.ts`; this card fetches the
 * plan file from the session workspace when the call carries no inline plan,
 * and on approve/reject back-fills `path`/`title`/`plan` into the resume data
 * so the persisted tool result replays the plan durably even after the plan
 * file changes or disappears.
 */

export interface SubmitPlanCardProps {
  toolCallId: string;
  input?: unknown;
  output?: unknown;
  isSubmitting?: boolean;
  onRespond?: (response: PlanResume) => void;
}

export function SubmitPlanCard({ toolCallId, input, output, isSubmitting = false, onRespond }: SubmitPlanCardProps) {
  const inline = resolveInlinePlan(input, output);
  const path = inline.path;

  const workspace = useThreadWorkspacePath();
  const fetchable = inline.plan === undefined && isPlanReadablePath(path);
  const file = usePlanFile(workspace.workspacePath, path, toolCallId, { enabled: fetchable });
  const fetched = fetchable && file.data?.content !== undefined ? parsePlanMarkdown(file.data.content) : undefined;

  const title = inline.title ?? fetched?.title ?? 'Plan';
  const plan = inline.plan ?? fetched?.plan ?? '';
  const loading =
    fetchable &&
    !fetched &&
    !file.isError &&
    (workspace.isPending || (Boolean(workspace.workspacePath) && file.isPending));
  const unavailable = inline.plan === undefined && !fetched && !loading;
  // Responding while the plan is still loading would back-fill an empty plan
  // into the durable result — hold responses until the fetch settles.
  const respondDisabled = isSubmitting || loading;

  const respond = (response: PlanResume) =>
    onRespond?.({
      ...response,
      ...(path ? { path } : {}),
      ...(plan ? { plan } : {}),
      ...(title !== 'Plan' || plan ? { title } : {}),
    });

  return (
    <Plan role="group" aria-label="Plan approval">
      <PlanHeader>
        <PlanLabel />
        <PlanHeaderActions>
          <PlanCopyButton content={plan} disabled={plan.length === 0} />
        </PlanHeaderActions>
      </PlanHeader>
      <PlanBody>
        <PlanIntro>
          <PlanTitle>{title}</PlanTitle>
          {path ? <PlanPath>{path}</PlanPath> : null}
        </PlanIntro>
        <PlanMain>
          {loading ? (
            <p aria-label="Loading plan" className="text-ui-sm text-neutral3 my-2">
              Loading plan…
            </p>
          ) : unavailable ? (
            <p role="note" className="text-ui-sm text-neutral3 my-2">
              The plan could not be loaded from {path ?? 'its file'}. You can still respond below.
            </p>
          ) : (
            <PlanContent>{plan}</PlanContent>
          )}
          {inline.feedback ? (
            <div role="note" aria-label="Plan feedback" className="border-accent1 mt-4 border-l-2 pl-3">
              <p className="text-ui-xs text-neutral3 mb-1">Feedback</p>
              <p className="text-ui-sm text-neutral5 whitespace-pre-wrap">{inline.feedback}</p>
            </div>
          ) : null}
          {onRespond ? (
            <PlanControls>
              <>
                <PlanActionGroup>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    className="whitespace-nowrap"
                    aria-label="Approve the plan and switch to build"
                    disabled={respondDisabled}
                    onClick={() => respond({ action: 'approved' })}
                  >
                    Approve & build
                  </Button>
                </PlanActionGroup>
                <span className="flex justify-center">
                  <PlanExpandButton />
                </span>
                <PlanActionGroup>
                  <Button
                    type="button"
                    size="sm"
                    className="whitespace-nowrap"
                    aria-label="Reject the plan"
                    disabled={respondDisabled}
                    onClick={() => respond({ action: 'rejected' })}
                  >
                    Reject
                  </Button>
                </PlanActionGroup>
              </>
            </PlanControls>
          ) : (
            // Resolved cards keep the expand control; it hides itself when the collapsed body is not clipped.
            <PlanControls />
          )}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}
