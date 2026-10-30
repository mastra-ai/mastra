import { ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  McpInputAction,
  McpInputRequest,
  McpInputRequestPayload,
  McpInputResponse,
  McpInputResumeData,
} from './mcp-input-request';
import { AskUserBody, AskUserContainer, AskUserLabel } from '@/ds/components/ai/ask-user';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { DynamicForm } from '@/lib/form/dynamic-form';
import { jsonSchemaToZodRuntime } from '@/lib/form/json-schema-to-zod-runtime';

export interface McpInputRequestToolProps {
  payload: McpInputRequestPayload;
  /** Sends the answers; the request stays open (and answerable again) if the returned promise rejects. */
  onSubmit: (resumeData: McpInputResumeData) => void | Promise<unknown>;
  isSubmitting?: boolean;
  /** Why the last answer didn't go through. */
  error?: string;
  /** History view: show the question without answering it. */
  readOnly?: boolean;
}

const ACTION_LABEL: Record<McpInputAction, string> = {
  accept: 'Accepted',
  decline: 'Declined',
  cancel: 'Cancelled',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type RequestView =
  | { kind: 'form'; message?: string; schema: Record<string, unknown> }
  | { kind: 'url'; message?: string; url: string }
  | { kind: 'unsupported'; message?: string };

const httpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
};

function viewRequest({ method, params }: McpInputRequest): RequestView {
  const message = typeof params?.message === 'string' ? params.message : undefined;
  if (method !== 'elicitation/create') return { kind: 'unsupported', message };
  // Only web links: a server-chosen `javascript:` URL must not become a clickable link.
  const url = params?.mode === 'url' ? httpUrl(params.url) : undefined;
  if (url) return { kind: 'url', message, url };
  if (params?.mode !== 'url' && isRecord(params?.requestedSchema)) {
    return { kind: 'form', message, schema: params.requestedSchema };
  }
  return { kind: 'unsupported', message };
}

/**
 * The questions an MCP server asked while a tool call's task waits. Every request key needs an answer
 * before the call can continue, so answers are held until the last one is given, then sent together.
 */
export function McpInputRequestTool({ payload, onSubmit, isSubmitting, error, readOnly }: McpInputRequestToolProps) {
  const [answers, setAnswers] = useState<Record<string, McpInputResponse>>({});
  const keys = Object.keys(payload.requests);

  const answer = (key: string, response: McpInputResponse) => {
    const next = { ...answers, [key]: response };
    setAnswers(next);
    if (!keys.every(requestKey => next[requestKey])) return;
    void Promise.resolve(onSubmit({ inputResponses: next })).catch(() => setAnswers({}));
  };

  return (
    <AskUserContainer className="mb-4" data-testid="mcp-input-request">
      <AskUserLabel>
        {payload.serverName} needs input to continue {payload.toolName}
      </AskUserLabel>
      <AskUserBody className="flex flex-col gap-4">
        {Object.entries(payload.requests).map(([key, request]) => (
          <InputRequest
            key={key}
            requestKey={key}
            request={request}
            answered={answers[key]?.action}
            disabled={readOnly || isSubmitting || answers[key] !== undefined}
            readOnly={readOnly}
            onAnswer={response => answer(key, response)}
          />
        ))}
        {error && (
          <Notice variant="destructive" role="alert">
            {error}
          </Notice>
        )}
      </AskUserBody>
    </AskUserContainer>
  );
}

function InputRequest({
  requestKey,
  request,
  answered,
  disabled,
  readOnly,
  onAnswer,
}: {
  requestKey: string;
  request: McpInputRequest;
  answered?: McpInputAction;
  disabled?: boolean;
  readOnly?: boolean;
  onAnswer: (response: McpInputResponse) => void;
}) {
  const view = useMemo(() => viewRequest(request), [request]);
  const schema = useMemo(() => (view.kind === 'form' ? jsonSchemaToZodRuntime(view.schema) : undefined), [view]);

  const decline = (
    <Button type="button" disabled={disabled} onClick={() => onAnswer({ action: 'decline' })}>
      Decline
    </Button>
  );
  const cancel = (
    <Button type="button" variant="ghost" disabled={disabled} onClick={() => onAnswer({ action: 'cancel' })}>
      Cancel
    </Button>
  );

  return (
    <section aria-label={`Input request ${requestKey}`} className="flex flex-col gap-3">
      {view.message && (
        <Txt variant="subheading" tone="ink">
          {view.message}
        </Txt>
      )}
      {answered ? (
        <Txt tone="muted">{ACTION_LABEL[answered]}</Txt>
      ) : readOnly ? null : view.kind === 'form' ? (
        <DynamicForm
          schema={schema}
          onSubmit={values => onAnswer({ action: 'accept', content: isRecord(values) ? values : {} })}
          isSubmitLoading={disabled}
          submitButtonLabel="Accept"
          submitButtonVariant="primary"
          submitActions={
            <>
              {decline}
              {cancel}
            </>
          }
        />
      ) : view.kind === 'url' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="link"
            render={<a href={view.url} target="_blank" rel="noopener noreferrer" />}
            iconEnd={<ExternalLink />}
          >
            Open link
          </Button>
          <Button type="button" variant="primary" disabled={disabled} onClick={() => onAnswer({ action: 'accept' })}>
            Done
          </Button>
          {cancel}
        </div>
      ) : (
        <>
          <Txt tone="muted">Studio can't answer a {request.method} request.</Txt>
          <CodeEditor data={{ ...request }} />
          <div className="flex gap-2">{cancel}</div>
        </>
      )}
    </section>
  );
}
