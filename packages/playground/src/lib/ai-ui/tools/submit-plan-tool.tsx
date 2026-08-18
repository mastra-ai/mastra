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
import { Button } from '@mastra/playground-ui/components/Button';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useAgentPlan } from '@/domains/agents/hooks/use-agent-plan';
import type { MessageMetadata } from '@/lib/ai-ui/messages/message-metadata';
import { useToolCall } from '@/services/tool-call-provider';

const PLAN_EXPAND_CHARACTER_THRESHOLD = 500;

export interface SubmitPlanToolProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
  toolName: string;
  toolCallId: string;
  output: unknown;
  metadata?: MessageMetadata;
}

interface SubmittedPlan {
  title: string;
  path?: string;
  content: string;
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

  return { title: headingMatch[1].trim(), body };
}

function getSubmittedPlan(output: unknown): SubmittedPlan | undefined {
  if (!isRecord(output) || !isRecord(output.submittedPlan)) return undefined;

  const content = getString(output.submittedPlan.plan);
  if (!content) return undefined;

  const document = getPlanDocument(content);

  return {
    title: getString(output.submittedPlan.title) ?? document.title,
    path: getString(output.submittedPlan.path),
    content,
  };
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
  const canExpand = document.body.length > PLAN_EXPAND_CHARACTER_THRESHOLD;

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
          {canExpand ? <PlanControls /> : null}
        </PlanMain>
      </PlanBody>
    </Plan>
  );
}

interface PendingPlanCardProps {
  agentId: string;
  agentVersionId?: string;
  requestContext?: Record<string, unknown>;
  toolCallId: string;
  path: string;
}

function PendingPlanCard({ agentId, agentVersionId, requestContext, toolCallId, path }: PendingPlanCardProps) {
  const { data, isLoading, isError } = useAgentPlan({ agentId, agentVersionId, requestContext, path });
  const { approveToolcall, isRunning, toolCallApprovals } = useToolCall();
  const content = data?.content;
  const document = content ? getPlanDocument(content) : undefined;
  const canExpand = Boolean(document && document.body.length > PLAN_EXPAND_CHARACTER_THRESHOLD);
  const isAnswered = toolCallApprovals[toolCallId] !== undefined;
  const controlsDisabled = isLoading || isRunning || isAnswered;

  const resume = (action: 'approved' | 'rejected') => {
    approveToolcall(toolCallId, {
      action,
      path,
      ...(document ? { title: document.title, plan: content } : {}),
    });
  };

  const approveAction = (
    <Button
      type="button"
      size="sm"
      variant="primary"
      aria-label="Approve the plan and switch to build"
      className="shrink-0 whitespace-nowrap"
      disabled={controlsDisabled}
      onClick={() => resume('approved')}
    >
      Approve &amp; build
    </Button>
  );
  const rejectAction = (
    <Button
      type="button"
      size="sm"
      aria-label="Reject the plan"
      disabled={controlsDisabled}
      onClick={() => resume('rejected')}
    >
      Reject
    </Button>
  );

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
            <Txt as="p" variant="ui-sm" className="text-neutral4">
              Unable to load the submitted plan.
            </Txt>
          ) : null}
          {document ? <PlanContent>{document.body}</PlanContent> : null}
          <PlanControls>
            {canExpand ? (
              <>
                <PlanActionGroup>{approveAction}</PlanActionGroup>
                <PlanExpandButton />
                <PlanActionGroup>{rejectAction}</PlanActionGroup>
              </>
            ) : (
              <PlanActionGroup>
                {approveAction}
                {rejectAction}
              </PlanActionGroup>
            )}
          </PlanControls>
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
