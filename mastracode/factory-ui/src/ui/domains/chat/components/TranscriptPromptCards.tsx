import type { PlanResume } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Input } from '@mastra/playground-ui/components/Input';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useState } from 'react';

import type { ApprovalPrompt, SubagentEntry, SuspensionPrompt } from '../services/transcript';
import { SubmitPlanCard } from './SubmitPlanCard';
import { resultBlock, stringify, truncate } from './transcript-shared';

// Prompt cards (approval / suspension) — an elevated card with a colored left rail.
const promptCardBase = 'my-2 rounded-lg border border-border1 bg-surface3 px-4 py-3 shadow-md';
const promptCardApproval = `${promptCardBase} border-l-4 border-l-warning1`;
const promptCardSuspension = `${promptCardBase} border-l-4 border-l-accent2`;
const promptTitle = 'mb-1.5 text-sm font-semibold text-icon6';
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
    <div className={promptCardApproval} role="group" aria-label={`Tool approval for ${prompt.toolName}`}>
      <div className={promptTitle}>
        Approve <code className="bg-surface5 rounded px-1.5 py-px font-mono text-xs">{prompt.toolName}</code>?
      </div>
      <pre className={resultBlock}>{truncate(stringify(prompt.args), 400)}</pre>
      <div className={promptActions}>
        <Button
          variant="primary"
          size="sm"
          aria-label={`Approve ${prompt.toolName}`}
          autoFocus
          disabled={isSubmitting}
          onClick={() => onApprove(prompt.toolCallId, true, prompt.id)}
        >
          Approve
        </Button>
        <Button
          size="sm"
          aria-label={`Decline ${prompt.toolName}`}
          disabled={isSubmitting}
          onClick={() => onApprove(prompt.toolCallId, false, prompt.id)}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}

interface SuspendPayloadShape {
  question?: string;
  options?: { label: string; description?: string }[];
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
        <div className={promptTitle}>Grant access to {payload.requestedPath ?? 'a path'}?</div>
        {payload.reason && <div className="text-icon3 mt-0.5 text-xs">Reason: {payload.reason}</div>}
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
  onRespond: (toolCallId: string, resumeData: string | string[], promptId: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const options = payload.options ?? [];
  const question = payload.question ?? 'The agent has a question';
  return (
    <div className={promptCardSuspension} role="group" aria-label="Question from the agent">
      <div className={promptTitle}>{question}</div>
      {options.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label="Answer options">
          {options.map(opt => (
            <Button
              key={opt.label}
              variant="outline"
              size="sm"
              className="justify-start"
              aria-label={opt.description ? `${opt.label}: ${opt.description}` : opt.label}
              disabled={isSubmitting}
              onClick={() => onRespond(prompt.toolCallId, opt.label, prompt.id)}
            >
              <strong>{opt.label}</strong>
              {opt.description && <span className="text-icon3"> — {opt.description}</span>}
            </Button>
          ))}
        </div>
      ) : (
        <form
          className="mt-2 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            if (draft.trim()) onRespond(prompt.toolCallId, draft.trim(), prompt.id);
          }}
        >
          <Input
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Your answer…"
            aria-label={question}
            disabled={isSubmitting}
            autoFocus
          />
          <Button variant="primary" size="sm" type="submit" disabled={isSubmitting}>
            Reply
          </Button>
        </form>
      )}
    </div>
  );
}

export function SubagentCard({ entry }: { entry: SubagentEntry }) {
  return (
    <div className="border-border1 border-l-accent5 bg-surface2 my-2 rounded-lg border border-l-4 px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2">
        <Badge variant={entry.done ? 'green' : 'blue'}>subagent: {entry.agentType}</Badge>
        <Txt variant="ui-xs" className="text-icon3">
          {lastSegment(entry.modelId)}
        </Txt>
      </div>
      <Txt variant="ui-sm" className="py-1">
        {entry.task}
      </Txt>
    </div>
  );
}
