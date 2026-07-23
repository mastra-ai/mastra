import type { PlanResume } from '@mastra/client-js';
import { AskUser } from '@mastra/playground-ui/components/ai/ask-user';
import type { AskUserAnswer, AskUserOption, AskUserPayload } from '@mastra/playground-ui/components/ai/ask-user';
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
import { memo } from 'react';
import type { ReactNode } from 'react';

type ToolStatus = 'running' | 'done' | 'error';

type ToolResponse = AskUserAnswer | PlanResume;

export interface ToolFactoryProps {
  toolName: string;
  toolCallId: string;
  input?: unknown;
  output?: unknown;
  status: ToolStatus;
  isSubmitting?: boolean;
  onRespond?: (response: ToolResponse) => void;
  fallback: () => ReactNode;
}

const hiddenTranscriptTools = new Set(['task_write', 'task_update', 'task_complete', 'task_check']);

export function isTranscriptToolVisible(toolName: string) {
  return !hiddenTranscriptTools.has(toolName);
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function askUserResultContent(output: unknown): string | undefined {
  return stringValue(output) ?? stringValue(record(output)?.content);
}

function askUserOptions(value: unknown): AskUserOption[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const options = value.flatMap(option => {
    const optionValue = record(option);
    const label = stringValue(optionValue?.label);
    if (!label) return [];

    const normalized: AskUserOption = { label };
    const description = stringValue(optionValue?.description);
    if (description) normalized.description = description;
    return [normalized];
  });

  return options.length > 0 ? options : undefined;
}

function askUserPayload(input: unknown): AskUserPayload | undefined {
  const payload = record(input);
  const question = stringValue(payload?.question);
  if (!question) return undefined;

  const options = askUserOptions(payload?.options);
  const selectionMode = payload?.selectionMode === 'multi_select' ? 'multi_select' : 'single_select';

  return { question, ...(options ? { options, selectionMode } : {}) };
}

interface PlanData {
  title: string;
  path?: string;
  content: string;
}

function planData(input: unknown, output: unknown): PlanData {
  // Resolved entries persist the full plan in the tool result (`submittedPlan`);
  // prefer it so historical transcripts render offline without any fetch.
  const submitted = record(record(output)?.submittedPlan);
  const payload = record(input);
  const plan = record(payload?.plan) ?? payload;
  const path = stringValue(submitted?.path) ?? stringValue(plan?.path) ?? stringValue(payload?.path);
  return {
    title: stringValue(submitted?.title) ?? stringValue(plan?.title) ?? 'Plan',
    ...(path ? { path } : {}),
    content: stringValue(submitted?.plan) ?? stringValue(plan?.content) ?? stringValue(plan?.summary) ?? '',
  };
}

function ToolFactoryComponent({
  toolName,
  input,
  output,
  status,
  isSubmitting = false,
  onRespond,
  fallback,
}: ToolFactoryProps) {
  if (toolName === 'ask_user') {
    const payload = askUserPayload(input);
    if (status === 'running' && (!payload || !onRespond)) return null;

    const resultContent = status !== 'running' ? askUserResultContent(output) : undefined;
    const result = resultContent ? { content: resultContent, isError: status === 'error' } : undefined;
    return (
      <AskUser
        role="group"
        aria-label="Question from the agent"
        payload={payload ?? { question: 'Question from the agent' }}
        {...(result ? { result } : {})}
        isSubmitting={isSubmitting}
        onSubmit={answer => onRespond?.(answer)}
        className="w-full max-w-full"
      />
    );
  }

  if (!isTranscriptToolVisible(toolName)) return null;

  if (toolName === 'submit_plan') {
    const plan = planData(input, output);
    return (
      <Plan role="group" aria-label="Plan approval">
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
            <PlanContent>{plan.content}</PlanContent>
            <PlanControls>
              {onRespond ? (
                <>
                  <PlanActionGroup>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      aria-label="Approve the plan and switch to build"
                      disabled={isSubmitting}
                      onClick={() => onRespond({ action: 'approved' })}
                    >
                      Approve & build
                    </Button>
                  </PlanActionGroup>
                  <PlanExpandButton />
                  <PlanActionGroup>
                    <Button
                      type="button"
                      size="sm"
                      aria-label="Reject the plan"
                      disabled={isSubmitting}
                      onClick={() => onRespond({ action: 'rejected' })}
                    >
                      Reject
                    </Button>
                  </PlanActionGroup>
                </>
              ) : null}
            </PlanControls>
          </PlanMain>
        </PlanBody>
      </Plan>
    );
  }

  return fallback();
}

export const ToolFactory = memo(ToolFactoryComponent);
