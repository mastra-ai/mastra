import { useMemo, useState } from 'react';
import type {
  McpInputAction,
  McpInputRequest,
  McpInputRequestPayload,
  McpInputResponse,
  McpInputResumeData,
} from './mcp-input-request';
import { inputRequestTooLarge } from './mcp-input-request';
import { AskUserBody, AskUserContainer, AskUserLabel } from '@/ds/components/ai/ask-user';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';
import { IconSquareArrowTopRight } from '@/ds/icons/central/IconSquareArrowTopRight';
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
  /** Why the request can't be answered here, shown with the questions. */
  notice?: string;
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

/** More fields than any real question needs; a bigger form is not one Studio should draw. */
const MAX_FORM_FIELDS = 100;
const FIELD_TYPES = new Set(['string', 'number', 'integer', 'boolean']);
// Keywords the MCP spec allows on a requested field. `pattern` isn't one: a server-chosen regex would
// run against every keystroke.
const FIELD_KEYS = [
  'type',
  'title',
  'description',
  'default',
  'enum',
  'enumNames',
  'format',
  'minLength',
  'maxLength',
  'minimum',
  'maximum',
];

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

/**
 * The MCP spec limits `requestedSchema` to a flat object of primitive fields. Keep only that shape, so a
 * server can't hand Studio a deep or huge schema to convert; anything else isn't a form Studio draws.
 */
function formSchema(requested: Record<string, unknown>): Record<string, unknown> | undefined {
  const { type, properties, required } = requested;
  if (type !== 'object' || !isRecord(properties)) return undefined;
  const entries = Object.entries(properties);
  if (entries.length > MAX_FORM_FIELDS) return undefined;
  const fields: Record<string, Record<string, unknown>> = {};
  for (const [key, field] of entries) {
    if (!isRecord(field) || typeof field.type !== 'string' || !FIELD_TYPES.has(field.type)) return undefined;
    if (field.enum !== undefined && !isStringList(field.enum)) return undefined;
    fields[key] = Object.fromEntries(
      FIELD_KEYS.filter(name => field[name] !== undefined).map(name => [name, field[name]]),
    );
  }
  return { type: 'object', properties: fields, ...(isStringList(required) ? { required } : {}) };
}

function viewRequest({ method, params }: McpInputRequest): RequestView {
  const message = typeof params?.message === 'string' ? params.message : undefined;
  if (method !== 'elicitation/create') return { kind: 'unsupported', message };
  // Only web links: a server-chosen `javascript:` URL must not become a clickable link.
  const url = params?.mode === 'url' ? httpUrl(params.url) : undefined;
  if (url) return { kind: 'url', message, url };
  const schema =
    params?.mode !== 'url' && isRecord(params?.requestedSchema) ? formSchema(params.requestedSchema) : undefined;
  if (schema) return { kind: 'form', message, schema };
  return { kind: 'unsupported', message };
}

/**
 * The questions an MCP server asked while a tool call's task waits. Every request key needs an answer
 * before the call can continue, so answers are held until the last one is given, then sent together.
 */
export function McpInputRequestTool({
  payload,
  onSubmit,
  isSubmitting,
  error,
  readOnly,
  notice,
}: McpInputRequestToolProps) {
  // A Map, not an object: request keys come from the server, and one named `constructor` or
  // `__proto__` must not read `Object.prototype` and look answered.
  const [answers, setAnswers] = useState<ReadonlyMap<string, McpInputResponse>>(() => new Map());
  const keys = Object.keys(payload.requests);
  const tooLarge = useMemo(() => inputRequestTooLarge(payload), [payload]);

  const send = (next: ReadonlyMap<string, McpInputResponse>) => {
    // `Object.fromEntries` defines own properties, so a `__proto__` key is sent as data.
    const inputResponses = Object.fromEntries(next);
    void Promise.resolve(onSubmit({ inputResponses })).catch(() => setAnswers(new Map()));
  };

  const answer = (key: string, response: McpInputResponse) => {
    const next = new Map(answers).set(key, response);
    setAnswers(next);
    if (!keys.every(requestKey => next.has(requestKey))) return;
    send(next);
  };

  const cancelAll = () => {
    const next = new Map(keys.map(key => [key, { action: 'cancel' as const }]));
    setAnswers(next);
    send(next);
  };

  return (
    <AskUserContainer className="mb-4" data-testid="mcp-input-request">
      <AskUserLabel>
        {payload.serverName} needs input to continue {payload.toolName}
      </AskUserLabel>
      <AskUserBody className="flex flex-col gap-4">
        {notice && <Notice variant="info">{notice}</Notice>}
        {tooLarge ? (
          <>
            <Txt tone="muted">{payload.serverName} sent more than Studio can show here.</Txt>
            {!readOnly && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={isSubmitting || answers.size > 0} onClick={cancelAll}>
                  Cancel
                </Button>
              </div>
            )}
          </>
        ) : (
          Object.entries(payload.requests).map(([key, request]) => (
            <InputRequest
              key={key}
              requestKey={key}
              request={request}
              answered={answers.get(key)?.action}
              disabled={readOnly || isSubmitting || answers.has(key)}
              readOnly={readOnly}
              onAnswer={response => answer(key, response)}
            />
          ))
        )}
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
            iconEnd={<IconSquareArrowTopRight />}
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
