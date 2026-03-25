'use client';

import { MastraClient, type CreateResponseParams, type ResponsesResponse, type ResponsesStreamEvent } from '@mastra/client-js';
import { startTransition, type ReactNode, useEffect, useState } from 'react';

type TurnState = {
  turnId: string;
  prompt: string;
  responseId: string | null;
  previousResponseId: string | null;
  providerResponseId: string | null;
  tools: ToolState[];
  text: string;
  raw: string;
  model: string | null;
  latencyMs: number | null;
  tokenCount: number | null;
  mode: 'json' | 'stream';
  status: 'pending' | 'done' | 'error';
};

type ToolState = {
  callId: string;
  toolName: string;
  arguments?: unknown;
  output?: unknown;
};

type ExampleId = 'agent-memory' | 'agent-tools' | 'provider-backed';

type ExampleConfig = {
  id: ExampleId;
  label: string;
  description: string;
  detail: string;
  instructions: string;
  model: string;
  store: boolean;
  usesProviderContinuation: boolean;
  prompts: readonly string[];
};

type StreamState = {
  responseId: string | null;
  providerResponseId: string | null;
  tools: ToolState[];
  text: string;
  raw: string;
  model: string | null;
};

type TurnPatch = Pick<TurnState, 'responseId' | 'providerResponseId' | 'tools' | 'text' | 'raw' | 'model' | 'tokenCount'>;

const DEFAULT_MODEL = `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`;
const DEFAULT_AGENT_ID = process.env.NEXT_PUBLIC_MASTRA_AGENT_ID ?? 'support-agent';
const TOOL_AGENT_ID = process.env.NEXT_PUBLIC_MASTRA_TOOL_AGENT_ID ?? 'tool-agent';
const AGENT_TOOLS_EXAMPLE = 'agent-tools';
const mastraClient = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_MASTRA_BASE_URL ?? 'http://localhost:4111',
});

const EXAMPLES: readonly ExampleConfig[] = [
  {
    id: 'agent-memory',
    label: 'Mastra Agent',
    description: 'Uses `agent_id`, `store: true`, and a Mastra agent with memory for follow-up turns.',
    detail: 'Each reply returns a stored response ID, and the next turn sends it as `previous_response_id` to continue the chain.',
    instructions:
      'You are a memory-backed Mastra agent. Use prior stored turns when the user asks follow-up questions.',
    model: DEFAULT_MODEL,
    store: true,
    usesProviderContinuation: false,
    prompts: [
      'Plan a three-step launch checklist for a new AI feature.',
      'Remember that the launch date is next Tuesday.',
      'What date did I tell you to remember?',
    ],
  },
  {
    id: 'agent-tools',
    label: 'Mastra Agent + Tool',
    description: 'Uses `agent_id`, `store: true`, and a Mastra agent that can call a real tool.',
    detail:
      'This agent can call `release-status` during the turn, then the stored response stays anchored on the final assistant message.',
    instructions:
      'You are a Mastra agent with tools. Use tools when the user asks about launch readiness or release status.',
    model: DEFAULT_MODEL,
    store: true,
    usesProviderContinuation: false,
    prompts: [
      'Check release readiness for the Responses API migration.',
      'Who owns it?',
      'What open items are left before rollout?',
    ],
  },
  {
    id: 'provider-backed',
    label: 'Provider-backed Agent',
    description:
      'Uses `agent_id` with provider-managed continuation via `providerOptions.openai.previousResponseId`.',
    detail:
      'Each response returns the provider response ID, and the next turn sends it back through `providerOptions` instead of Mastra `previous_response_id`.',
    instructions:
      'You are an OpenAI provider-backed Responses API example. Continue the conversation using provider-native continuation state.',
    model: DEFAULT_MODEL,
    store: false,
    usesProviderContinuation: true,
    prompts: [
      'Tell me three facts about Saturn.',
      'Expand on the second fact.',
      'Now turn that into a tweet thread.',
    ],
  },
] as const;

const EXAMPLE_BY_ID = Object.fromEntries(EXAMPLES.map(example => [example.id, example])) as Record<ExampleId, ExampleConfig>;

function createTurnId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `turn-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function truncateResponseId(responseId: string | null) {
  if (!responseId) {
    return 'resp:new';
  }

  if (responseId.length <= 22) {
    return responseId;
  }

  return `${responseId.slice(0, 14)}...${responseId.slice(-6)}`;
}

function estimateTokenCount(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return Math.max(1, Math.round(trimmed.split(/\s+/).length * 1.35));
}

function formatLatency(latencyMs: number | null) {
  if (latencyMs === null) {
    return '—';
  }

  if (latencyMs < 1000) {
    return `${Math.round(latencyMs)} ms`;
  }

  return `${(latencyMs / 1000).toFixed(1)} s`;
}

function extractResponseId(payload: unknown) {
  if (isRecord(payload) && typeof payload.id === 'string') {
    return payload.id;
  }

  return null;
}

function extractOutputText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  return '';
}

function extractModel(payload: unknown, fallbackModel: string | null) {
  if (isRecord(payload) && typeof payload.model === 'string') {
    return payload.model;
  }

  return fallbackModel;
}

function extractProviderResponseId(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.providerOptions)) {
    return null;
  }

  const openaiOptions = payload.providerOptions.openai;
  if (!isRecord(openaiOptions) || typeof openaiOptions.responseId !== 'string') {
    return null;
  }

  return openaiOptions.responseId;
}

function parseToolPayload(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function extractToolActivity(payload: unknown): ToolState[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }

  const tools = new Map<string, ToolState>();

  for (const item of payload.output) {
    if (!isRecord(item) || typeof item.type !== 'string') {
      continue;
    }

    if (item.type === 'function_call' && typeof item.call_id === 'string' && typeof item.name === 'string') {
      const existingTool = tools.get(item.call_id);
      tools.set(item.call_id, {
        callId: item.call_id,
        toolName: item.name,
        arguments:
          typeof item.arguments === 'string' ? parseToolPayload(item.arguments) : (existingTool?.arguments ?? undefined),
        output: existingTool?.output,
      });
      continue;
    }

    if (item.type === 'function_call_output' && typeof item.call_id === 'string') {
      const existingTool = tools.get(item.call_id);
      tools.set(item.call_id, {
        callId: item.call_id,
        toolName: existingTool?.toolName ?? 'Tool',
        arguments: existingTool?.arguments,
        output: typeof item.output === 'string' ? parseToolPayload(item.output) : item.output,
      });
    }
  }

  return [...tools.values()];
}

function extractTokenCount(payload: unknown, fallbackText: string) {
  if (isRecord(payload) && isRecord(payload.usage)) {
    const usage = payload.usage;
    if (typeof usage.output_tokens === 'number') {
      return usage.output_tokens;
    }

    if (typeof usage.total_tokens === 'number') {
      return usage.total_tokens;
    }
  }

  return estimateTokenCount(fallbackText);
}

function extractErrorMessage(raw: string) {
  if (!raw) {
    return 'Request failed.';
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && typeof parsed.error === 'string') {
      return parsed.error;
    }
  } catch {}

  return raw;
}

function buildRequestBody<T extends CreateResponseParams & { example?: ExampleId }>(params: T): Omit<T, 'example'> {
  const request = { ...params };
  delete request.example;

  if (request.agent_id == null) {
    request.agent_id = params.example === AGENT_TOOLS_EXAMPLE ? TOOL_AGENT_ID : DEFAULT_AGENT_ID;
  }

  return request;
}

function updateTurn(turns: TurnState[], turnId: string, updater: (turn: TurnState) => TurnState) {
  return turns.map(turn => (turn.turnId === turnId ? updater(turn) : turn));
}

function getNextAnchor(turns: TurnState[], example: ExampleConfig) {
  const latestTurn = turns.at(-1);

  if (!latestTurn) {
    return null;
  }

  if (example.store) {
    return latestTurn.responseId ?? latestTurn.previousResponseId ?? null;
  }

  if (example.usesProviderContinuation) {
    return latestTurn.providerResponseId ?? null;
  }

  return null;
}

function getContinuationState(turns: TurnState[], example: ExampleConfig) {
  const latestTurn = turns.at(-1);

  return {
    previousResponseId: example.store ? latestTurn?.responseId ?? null : null,
    previousProviderResponseId: example.usesProviderContinuation ? latestTurn?.providerResponseId ?? null : null,
  };
}

function createPendingTurn(
  turnId: string,
  prompt: string,
  mode: 'json' | 'stream',
  previousResponseId: string | null,
): TurnState {
  return {
    turnId,
    prompt,
    responseId: null,
    previousResponseId,
    providerResponseId: null,
    tools: [],
    text: '',
    raw: '',
    model: null,
    latencyMs: 0,
    tokenCount: 0,
    mode,
    status: 'pending',
  };
}

function buildExampleRequest(
  example: ExampleConfig,
  input: string,
  previousResponseId: string | null,
  previousProviderResponseId: string | null,
) {
  return buildRequestBody({
    model: example.model,
    input,
    instructions: example.instructions,
    example: example.id,
    ...(example.store ? { store: true, previous_response_id: previousResponseId ?? undefined } : {}),
    ...(example.usesProviderContinuation && previousProviderResponseId
      ? {
          providerOptions: {
            openai: {
              previousResponseId: previousProviderResponseId,
            },
          },
        }
      : {}),
  });
}

function createTurnPatch(payload: unknown, fallbackModel: string | null): TurnPatch {
  const text = extractOutputText(payload);

  return {
    responseId: extractResponseId(payload),
    providerResponseId: extractProviderResponseId(payload),
    tools: extractToolActivity(payload),
    text,
    raw: JSON.stringify(payload, null, 2),
    model: extractModel(payload, fallbackModel),
    tokenCount: extractTokenCount(payload, text),
  };
}

function createInitialStreamState(
  previousResponseId: string | null,
  previousProviderResponseId: string | null,
  model: string,
): StreamState {
  return {
    responseId: previousResponseId,
    providerResponseId: previousProviderResponseId,
    tools: [],
    text: '',
    raw: '',
    model,
  };
}

function applyStreamEvent(state: StreamState, event: ResponsesStreamEvent): StreamState {
  if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
    return {
      ...state,
      text: `${state.text}${event.delta}`,
    };
  }

  if (
    (event.type === 'response.created' || event.type === 'response.in_progress' || event.type === 'response.completed') &&
    isRecord(event.response)
  ) {
    const nextState: StreamState = {
      ...state,
      responseId: typeof event.response.id === 'string' ? event.response.id : state.responseId,
      providerResponseId: extractProviderResponseId(event.response) ?? state.providerResponseId,
      tools: extractToolActivity(event.response),
      model: extractModel(event.response, state.model),
    };

    if (event.type === 'response.completed') {
      const completedText = extractOutputText(event.response);

      return {
        ...nextState,
        text: completedText || nextState.text,
        raw: JSON.stringify(event.response, null, 2),
      };
    }

    return nextState;
  }

  return state;
}

function finalizeStreamPatch(state: StreamState): TurnPatch {
  return {
    responseId: state.responseId,
    providerResponseId: state.providerResponseId,
    tools: state.tools,
    text: state.text,
    raw: state.raw,
    model: state.model,
    tokenCount: state.raw ? extractTokenCount(JSON.parse(state.raw) as unknown, state.text) : estimateTokenCount(state.text),
  };
}

function AnimatedResponseText({ text }: { text: string }) {
  const segments = text.split(/(\s+)/);

  return (
    <p className="demo-message__response">
      {segments.map((segment, index) => {
        if (!segment) {
          return null;
        }

        if (/^\s+$/.test(segment)) {
          return <span key={`space-${index}`}>{segment}</span>;
        }

        return (
          <span
            key={`token-${index}-${segment}`}
            className="demo-message__response-token"
            style={{ animationDelay: `${Math.min(index * 18, 560)}ms` }}
          >
            {segment}
          </span>
        );
      })}
    </p>
  );
}

function renderJsonLine(line: string) {
  const tokens: ReactNode[] = [];
  const tokenPattern = /"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(line)) !== null) {
    const [token] = match;
    const index = match.index;

    if (index > cursor) {
      tokens.push(<span key={`plain-${cursor}`}>{line.slice(cursor, index)}</span>);
    }

    const remainder = line.slice(index + token.length).trimStart();
    let className = 'demo-json__punctuation';

    if (token.startsWith('"')) {
      className = remainder.startsWith(':') ? 'demo-json__key' : 'demo-json__string';
    } else if (token === 'true' || token === 'false') {
      className = 'demo-json__boolean';
    } else if (token === 'null') {
      className = 'demo-json__null';
    } else if (!Number.isNaN(Number(token))) {
      className = 'demo-json__number';
    }

    tokens.push(
      <span className={className} key={`token-${index}`}>
        {token}
      </span>,
    );
    cursor = index + token.length;
  }

  if (cursor < line.length) {
    tokens.push(<span key={`tail-${cursor}`}>{line.slice(cursor)}</span>);
  }

  return tokens;
}

function JsonPreview({ raw }: { raw: string }) {
  return (
    <pre className="demo-json">
      <code>
        {raw.split('\n').map((line, index) => (
          <span className="demo-json__line" key={`line-${index}`}>
            {renderJsonLine(line)}
          </span>
        ))}
      </code>
    </pre>
  );
}

function formatToolValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function MigrationDemo() {
  const [activeExampleId, setActiveExampleId] = useState<ExampleId>('agent-memory');
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'idle' | 'json' | 'stream'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [openRawTurnId, setOpenRawTurnId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [turns, setTurns] = useState<TurnState[]>([]);
  const [activeRequest, setActiveRequest] = useState<{ turnId: string; startedAt: number } | null>(null);

  const activeExample = EXAMPLE_BY_ID[activeExampleId];
  const isPending = mode !== 'idle';
  const currentAnchor = getNextAnchor(turns, activeExample);
  const completedTurns = turns.filter(turn => turn.status === 'done').length;
  const statusBadge = currentAnchor ? truncateResponseId(currentAnchor) : 'awaiting-agent';

  useEffect(() => {
    if (!toastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    if (!activeRequest) {
      return;
    }

    const interval = window.setInterval(() => {
      const latencyMs = performance.now() - activeRequest.startedAt;

      setTurns(current =>
        updateTurn(current, activeRequest.turnId, turn => ({
          ...turn,
          latencyMs,
          tokenCount: estimateTokenCount(turn.text),
        })),
      );
    }, 120);

    return () => window.clearInterval(interval);
  }, [activeRequest]);

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToastMessage('Copied to clipboard');
    } catch {
      setToastMessage('Unable to copy');
    }
  };

  const handleExampleChange = (exampleId: ExampleId) => {
    if (exampleId === activeExampleId || isPending) {
      return;
    }

    setActiveExampleId(exampleId);
    setInput('');
    setMode('idle');
    setError(null);
    setOpenRawTurnId(null);
    setTurns([]);
    setActiveRequest(null);
  };

  const submit = async (nextMode: 'json' | 'stream') => {
    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return;
    }

    const { previousResponseId, previousProviderResponseId } = getContinuationState(turns, activeExample);
    const turnId = createTurnId();
    const startedAt = performance.now();

    setError(null);
    setMode(nextMode);
    setOpenRawTurnId(null);
    setActiveRequest({ turnId, startedAt });
    setTurns(current => [...current, createPendingTurn(turnId, trimmedInput, nextMode, previousResponseId)]);
    setInput('');

    try {
      const requestBody = buildExampleRequest(
        activeExample,
        trimmedInput,
        previousResponseId,
        previousProviderResponseId,
      );

      if (nextMode === 'json') {
        const payload = await mastraClient.responses.create({
          ...requestBody,
          stream: false,
        });
        const turnPatch = createTurnPatch(payload, activeExample.model);

        setTurns(current =>
          updateTurn(current, turnId, turn => ({
            ...turn,
            ...turnPatch,
            latencyMs: performance.now() - startedAt,
            status: 'done',
          })),
        );
        return;
      }

      let streamState = createInitialStreamState(previousResponseId, previousProviderResponseId, activeExample.model);
      const stream = await mastraClient.responses.stream(requestBody);

      for await (const event of stream) {
        if (!isRecord(event) || typeof event.type !== 'string') {
          continue;
        }

        streamState = applyStreamEvent(streamState, event);
        const turnPatch = finalizeStreamPatch(streamState);

        startTransition(() => {
          setTurns(current =>
            updateTurn(current, turnId, turn => ({
              ...turn,
              ...turnPatch,
              latencyMs: performance.now() - startedAt,
              status: event.type === 'response.completed' ? 'done' : 'pending',
            })),
          );
        });
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Request failed.';
      setError(message);
      setTurns(current =>
        updateTurn(current, turnId, turn => ({
          ...turn,
          text: message,
          latencyMs: performance.now() - startedAt,
          status: 'error',
        })),
      );
    } finally {
      setMode('idle');
      setActiveRequest(null);
    }
  };

  return (
    <main className="demo-shell demo-shell--with-sidebar">
      <aside className="demo-sidebar">
        <div className="demo-sidebar__header">
          <span className="demo-sidebar__eyebrow">Modes</span>
          <p className="demo-sidebar__intro">Switch between memory-backed, agent-with-tools, and provider-backed flows.</p>
        </div>

        <nav className="demo-sidebar__nav" aria-label="Example modes">
          {EXAMPLES.map(example => (
            <button
              key={example.id}
              className={`demo-sidebar-item${example.id === activeExampleId ? ' is-active' : ''}`}
              disabled={isPending}
              onClick={() => handleExampleChange(example.id)}
              type="button"
            >
              <span className="demo-sidebar-item__title">{example.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="demo-main">
        <header className="demo-topbar">
          <div className="demo-topbar__leading">
            <div className="demo-brand">
              <span className="demo-brand__icon" aria-hidden="true">
                M
              </span>
              <div className="demo-brand__copy">
                <span className="demo-brand__name">Mastra Responses API Demo</span>
                <span className="demo-brand__label">{activeExample.label}</span>
              </div>
            </div>

            <p className="demo-brand__subtitle">{activeExample.description}</p>
          </div>

          <span className="demo-response-badge" title={currentAnchor ?? statusBadge}>
            {statusBadge}
          </span>
        </header>

        <div className="demo-thread">
          <span className="demo-thread__dot" aria-hidden="true" />
          <span>Turn {String(Math.max(completedTurns + (isPending ? 1 : 0), 1)).padStart(2, '0')}</span>
          <span className="demo-thread__separator" aria-hidden="true" />
          <span>
            {activeExample.store
              ? currentAnchor
                ? `next turn will use ${truncateResponseId(currentAnchor)}`
                : 'first stored response creates the conversation anchor'
              : activeExample.usesProviderContinuation
                ? currentAnchor
                  ? `next turn will use provider response ${truncateResponseId(currentAnchor)}`
                  : 'first provider response creates the continuation anchor'
                : 'no continuation anchor yet'}
          </span>
        </div>

        <section className="demo-chat">
          <div className="demo-messages">
            {turns.length === 0 ? (
              <div className="demo-empty-state">
                <p>{activeExample.detail}</p>
                <div className="demo-chip-list">
                  {activeExample.prompts.map(prompt => (
                    <button key={prompt} className="demo-chip" onClick={() => setInput(prompt)} type="button">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              turns.map(turn => {
                const canCopy = Boolean(turn.text || turn.raw);
                const isRawOpen = openRawTurnId === turn.turnId;

                return (
                  <div className="demo-message-group" key={turn.turnId}>
                    <div className="demo-message demo-message--user">
                      <div className="demo-message__role">You</div>
                      <div className="demo-message__bubble demo-message__bubble--user">
                        <p>{turn.prompt}</p>
                      </div>
                    </div>

                    <div className="demo-message demo-message--assistant">
                      <div className="demo-message__role">Mastra</div>
                      <div className="demo-message__bubble demo-message__bubble--assistant">
                        <div className="demo-message__toolbar">
                          <div className="demo-message__response-id">
                            {activeExample.usesProviderContinuation
                              ? turn.providerResponseId ?? 'awaiting provider response'
                              : turn.responseId ?? (activeExample.store ? 'awaiting stored response' : 'ephemeral response')}
                          </div>

                          <div className="demo-message__actions">
                            {turn.status === 'pending' ? (
                              <span className="demo-thinking" aria-live="polite">
                                <span className="demo-thinking__dot" aria-hidden="true" />
                                Agent is thinking...
                              </span>
                            ) : null}

                            {canCopy ? (
                              <button
                                className="demo-toolbar-button demo-toolbar-button--copy"
                                onClick={() => void handleCopy(turn.text || turn.raw)}
                                type="button"
                              >
                                Copy
                              </button>
                            ) : null}

                            <button
                              className="demo-toolbar-button"
                              disabled={!turn.raw}
                              onClick={() => setOpenRawTurnId(current => (current === turn.turnId ? null : turn.turnId))}
                              type="button"
                            >
                              {isRawOpen ? 'Hide JSON' : 'Raw JSON'}
                            </button>
                          </div>
                        </div>

                        <div className="demo-message__body">
                          {turn.tools.length > 0 ? (
                            <div className="demo-tools">
                              {turn.tools.map((tool, index) => (
                                <div
                                  className="demo-tool"
                                  key={`${tool.callId}-${index}`}
                                >
                                  <div className="demo-tool__header">
                                    <span className="demo-tool__name">{tool.toolName}</span>
                                    <span className="demo-tool__state">completed</span>
                                  </div>

                                  {tool.arguments !== undefined ? (
                                    <div className="demo-tool__section">
                                      <span className="demo-tool__label">Arguments</span>
                                      <pre className="demo-tool__value">{formatToolValue(tool.arguments)}</pre>
                                    </div>
                                  ) : null}

                                  {tool.output !== undefined ? (
                                    <div className="demo-tool__section">
                                      <span className="demo-tool__label">Output</span>
                                      <pre className="demo-tool__value">{formatToolValue(tool.output)}</pre>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {turn.text ? (
                            turn.status === 'error' ? (
                              <p className="demo-turn__error">{turn.text}</p>
                            ) : (
                              <AnimatedResponseText text={turn.text} />
                            )
                          ) : (
                            <div className="demo-turn__pending">
                              <div className="demo-turn__shimmer" />
                              <div className="demo-turn__shimmer demo-turn__shimmer--short" />
                            </div>
                          )}
                        </div>

                        <div className="demo-message__footer">
                          <span>{turn.model ?? 'awaiting model'}</span>
                          <span>{formatLatency(turn.latencyMs)}</span>
                          <span>{turn.tokenCount ?? estimateTokenCount(turn.text)} tokens</span>
                          <span>{turn.mode === 'stream' ? 'stream' : 'send'}</span>
                        </div>

                        <div className={`demo-json-shell${isRawOpen ? ' is-open' : ''}`}>
                          <div className="demo-json-shell__inner">
                            <JsonPreview raw={turn.raw || 'No response payload yet.'} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="demo-composer">
            <textarea
              className="demo-textarea"
              rows={3}
              value={input}
              placeholder="Write a one-sentence bedtime story about a unicorn..."
              onChange={event => setInput(event.target.value)}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onKeyDown={event => {
                if (event.nativeEvent.isComposing) {
                  return;
                }

                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submit('json');
                }
              }}
            />

            <div className="demo-compose__footer">
              <span className={`demo-char-count${isInputFocused ? ' is-visible' : ''}`}>{input.length} characters</span>

              <div className="demo-actions">
                <span className="demo-actions__hint">Enter to send · Shift+Enter for newline</span>
                <div className="demo-actions__buttons">
                  <button
                    className="demo-button demo-button--primary"
                    disabled={isPending || input.trim().length === 0}
                    onClick={() => submit('json')}
                    type="button"
                  >
                    {mode === 'json' ? 'Sending...' : 'Send'}
                  </button>
                  <button
                    className="demo-button demo-button--secondary"
                    disabled={isPending || input.trim().length === 0}
                    onClick={() => submit('stream')}
                    type="button"
                  >
                    {mode === 'stream' ? 'Streaming...' : 'Stream'}
                  </button>
                </div>
              </div>
            </div>

            {error ? <p className="demo-error">{error}</p> : null}
          </div>
        </section>
      </section>

      <div className={`demo-toast${toastMessage ? ' is-visible' : ''}`} aria-live="polite" role="status">
        {toastMessage}
      </div>
    </main>
  );
}
