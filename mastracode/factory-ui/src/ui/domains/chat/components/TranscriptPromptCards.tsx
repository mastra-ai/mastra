import type { PlanResume } from '@mastra/client-js';
import { AskUser } from '@mastra/playground-ui/components/ai/ask-user';
import type { AskUserAnswer, AskUserPayload } from '@mastra/playground-ui/components/ai/ask-user';
import { ToolApproval } from '@mastra/playground-ui/components/ai/tool-approval';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Txt } from '@mastra/playground-ui/components/Txt';

import type { ApprovalPrompt, SubagentEntry, SuspensionPrompt } from '../services/transcript';
import { SubmitPlanCard } from './SubmitPlanCard';

const promptCardSuspension =
  'border-border border-l-warning-indicator bg-fill my-2 min-w-0 rounded-lg border border-l-4 px-4 py-3';
const promptTitle = 'mb-1.5';
const promptActions = 'mt-2 flex gap-2';

function lastSegment(id: string): string {
  const parts = id.split('/');
  return parts[parts.length - 1] ?? id;
}

function hasProperty<K extends string>(value: object, key: K): value is object & Record<K, unknown> {
  return key in value;
}

function stringProperty(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !hasProperty(value, key)) return undefined;
  return typeof value[key] === 'string' ? value[key] : undefined;
}

export function ApprovalCard({
  prompt,
  isSubmitting,
  onApprove,
}: {
  prompt: ApprovalPrompt;
  isSubmitting: boolean;
  onApprove: (toolCallId: string, approved: boolean, promptId: string) => void;
}) {
  return (
    <ToolApproval
      toolName={prompt.toolName}
      args={prompt.args}
      autoFocus
      disabled={isSubmitting}
      onApprove={() => onApprove(prompt.toolCallId, true, prompt.id)}
      onDecline={() => onApprove(prompt.toolCallId, false, prompt.id)}
    />
  );
}

interface SuspendPayloadShape {
  question?: string;
  options?: AskUserPayload['options'];
  selectionMode?: AskUserPayload['selectionMode'];
  requestedPath?: string;
  reason?: string;
  plan?: { title?: string; summary?: string };
  title?: string;
}

function suspensionPayloadShape(payload: unknown): SuspendPayloadShape {
  const planValue = payload && typeof payload === 'object' && hasProperty(payload, 'plan') ? payload.plan : undefined;
  const plan =
    planValue && typeof planValue === 'object'
      ? {
          title: stringProperty(planValue, 'title'),
          summary: stringProperty(planValue, 'summary'),
        }
      : undefined;

  const optionsValue =
    payload && typeof payload === 'object' && hasProperty(payload, 'options') ? payload.options : undefined;
  const options = Array.isArray(optionsValue)
    ? optionsValue.flatMap(option => {
        const label = stringProperty(option, 'label');
        if (!label) return [];
        return [{ label, description: stringProperty(option, 'description') }];
      })
    : undefined;

  return {
    question: stringProperty(payload, 'question'),
    options,
    selectionMode: stringProperty(payload, 'selectionMode') === 'multi_select' ? 'multi_select' : 'single_select',
    requestedPath: stringProperty(payload, 'requestedPath') ?? stringProperty(payload, 'path'),
    reason: stringProperty(payload, 'reason'),
    title: stringProperty(payload, 'title'),
    plan,
  };
}

export function SuspensionCard({
  prompt,
  isSubmitting,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: string | string[] | PlanResume, promptId: string) => void;
}) {
  const payload = suspensionPayloadShape(prompt.suspendPayload);

  if (prompt.toolName === 'submit_plan') {
    return (
      <SubmitPlanCard
        toolCallId={prompt.toolCallId}
        input={prompt.suspendPayload}
        isSubmitting={isSubmitting}
        onRespond={response => onRespond(prompt.toolCallId, response, prompt.id)}
      />
    );
  }

  if (prompt.toolName === 'request_access') {
    return (
      <div className={promptCardSuspension} role="group" aria-label="Access request">
        <Txt as="p" variant="subheading" tone="ink" className={promptTitle}>
          Grant access to {payload.requestedPath ?? 'a path'}?
        </Txt>
        {payload.reason && (
          <Txt as="p" variant="caption" tone="muted" className="mt-0.5">
            Reason: {payload.reason}
          </Txt>
        )}
        <div className={promptActions}>
          <Button
            variant="primary"
            size="sm"
            aria-label={`Allow access to ${payload.requestedPath ?? 'the requested path'}`}
            autoFocus
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, 'Yes', prompt.id)}
          >
            Allow
          </Button>
          <Button
            size="sm"
            aria-label={`Deny access to ${payload.requestedPath ?? 'the requested path'}`}
            disabled={isSubmitting}
            onClick={() => onRespond(prompt.toolCallId, 'No', prompt.id)}
          >
            Deny
          </Button>
        </div>
      </div>
    );
  }

  return <AskUserCard prompt={prompt} payload={payload} isSubmitting={isSubmitting} onRespond={onRespond} />;
}

function AskUserCard({
  prompt,
  payload,
  isSubmitting,
  onRespond,
}: {
  prompt: SuspensionPrompt;
  payload: SuspendPayloadShape;
  isSubmitting: boolean;
  onRespond: (toolCallId: string, resumeData: AskUserAnswer, promptId: string) => void;
}) {
  const askUserPayload: AskUserPayload = {
    question: payload.question ?? 'The agent has a question',
    options: payload.options,
    selectionMode: payload.selectionMode,
  };

  const handleAnswerSubmit = (answer: AskUserAnswer) => {
    onRespond(prompt.toolCallId, answer, prompt.id);
  };

  return (
    <AskUser
      key={prompt.id}
      role="group"
      aria-label="Question from the agent"
      className="my-2"
      payload={askUserPayload}
      isSubmitting={isSubmitting}
      onSubmit={handleAnswerSubmit}
    />
  );
}

export function SubagentCard({ entry }: { entry: SubagentEntry }) {
  return (
    <div className="border-border border-l-info-indicator bg-fill my-2 rounded-lg border border-l-4 px-3 py-2">
      <div className="flex items-center gap-2">
        <Badge variant={entry.done ? 'success' : 'info'}>subagent: {entry.agentType}</Badge>
        <Txt tone="muted" variant="meta">
          {lastSegment(entry.modelId)}
        </Txt>
      </div>
      <Txt variant="caption" className="py-1">
        {entry.task}
      </Txt>
    </div>
  );
}
