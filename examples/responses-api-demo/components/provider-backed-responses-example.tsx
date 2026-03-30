'use client';

import type { CreateResponseParams, ResponsesStreamEvent } from '@mastra/client-js';
import { MastraClient } from '@mastra/client-js';
import { startTransition, useEffect, useState } from 'react';

const client = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_MASTRA_BASE_URL ?? 'http://localhost:4111',
});

type ToolCall = {
  id: string;
  name: string;
  arguments?: unknown;
  output?: unknown;
};

type Turn = {
  id: string;
  prompt: string;
  responseId: string | null;
  providerResponseId: string | null;
  text: string;
  raw: string;
  model: string | null;
  tools: ToolCall[];
  tokenCount: number;
  latencyMs: number | null;
  mode: 'json' | 'stream';
  status: 'pending' | 'done' | 'error';
};

function createEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `turn-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function truncateId(value: string | null) {
  if (!value) {
    return 'awaiting-provider';
  }

  if (value.length <= 22) {
    return value;
  }

  return `${value.slice(0, 14)}...${value.slice(-6)}`;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function getOutputText(payload: unknown) {
  if (isRecord(payload) && typeof payload.output_text === 'string') {
    return payload.output_text;
  }

  return '';
}

function getResponseId(payload: unknown) {
  if (isRecord(payload) && typeof payload.id === 'string') {
    return payload.id;
  }

  return null;
}

function getProviderResponseId(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.providerOptions)) {
    return null;
  }

  const openai = payload.providerOptions.openai;
  if (!isRecord(openai) || typeof openai.responseId !== 'string') {
    return null;
  }

  return openai.responseId;
}

function getModel(payload: unknown) {
  if (isRecord(payload) && typeof payload.model === 'string') {
    return payload.model;
  }

  return `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`;
}

function getTokenCount(payload: unknown, text: string) {
  if (isRecord(payload) && isRecord(payload.usage)) {
    if (typeof payload.usage.output_tokens === 'number') {
      return payload.usage.output_tokens;
    }

    if (typeof payload.usage.total_tokens === 'number') {
      return payload.usage.total_tokens;
    }
  }

  return estimateTokenCount(text);
}

function getToolCalls(payload: unknown): ToolCall[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }

  const calls = new Map<string, ToolCall>();

  for (const item of payload.output) {
    if (!isRecord(item) || typeof item.type !== 'string') {
      continue;
    }

    switch (item.type) {
      case 'function_call':
        if (typeof item.call_id === 'string' && typeof item.name === 'string') {
          calls.set(item.call_id, {
            id: item.call_id,
            name: item.name,
            arguments: typeof item.arguments === 'string' ? parseJson(item.arguments) : undefined,
            output: calls.get(item.call_id)?.output,
          });
        }
        break;
      case 'function_call_output':
        if (typeof item.call_id === 'string') {
          const existing = calls.get(item.call_id);

          calls.set(item.call_id, {
            id: item.call_id,
            name: existing?.name ?? 'Tool',
            arguments: existing?.arguments,
            output: typeof item.output === 'string' ? parseJson(item.output) : item.output,
          });
        }
        break;
      default:
        break;
    }
  }

  return [...calls.values()];
}

function patchEntry(turns: Turn[], entryId: string, next: Partial<Turn>) {
  return turns.map(turn => (turn.id === entryId ? { ...turn, ...next } : turn));
}

export function ProviderBackedResponsesExample() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mode, setMode] = useState<'idle' | 'json' | 'stream'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [openRawTurnId, setOpenRawTurnId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activeRequest, setActiveRequest] = useState<{ entryId: string; startedAt: number } | null>(null);

  useEffect(() => {
    if (!activeRequest) {
      return;
    }

    const interval = window.setInterval(() => {
      setTurns(current =>
        patchEntry(current, activeRequest.entryId, {
          latencyMs: performance.now() - activeRequest.startedAt,
          tokenCount: estimateTokenCount(current.find(turn => turn.id === activeRequest.entryId)?.text ?? ''),
        }),
      );
    }, 120);

    return () => window.clearInterval(interval);
  }, [activeRequest]);

  async function submit(nextMode: 'json' | 'stream') {
    if (mode !== 'idle' || activeRequest) {
      return;
    }

    const prompt = input.trim();

    if (!prompt) {
      return;
    }

    const previousProviderResponseId =
      [...turns].reverse().find(turn => turn.providerResponseId)?.providerResponseId ?? null;
    const entryId = createEntryId();
    const startedAt = performance.now();

    setError(null);
    setMode(nextMode);
    setOpenRawTurnId(null);
    setActiveRequest({ entryId, startedAt });
    setTurns(current => [
      ...current,
      {
        id: entryId,
        prompt,
        responseId: null,
        providerResponseId: null,
        text: '',
        raw: '',
        model: null,
        tools: [],
        tokenCount: 0,
        latencyMs: 0,
        mode: nextMode,
        status: 'pending',
      },
    ]);
    setInput('');

    const request = {
      model: `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`,
      agent_id: 'support-agent',
      input: prompt,
      instructions:
        'You are an OpenAI provider-backed Responses API example. Continue the conversation using provider-native continuation state.',
      ...(previousProviderResponseId
        ? {
            providerOptions: {
              openai: {
                previousResponseId: previousProviderResponseId,
              },
            },
          }
        : {}),
    } satisfies CreateResponseParams;

    try {
      if (nextMode === 'json') {
        const response = await client.responses.create({
          ...request,
          stream: false,
        });

        const text = getOutputText(response);

        setTurns(current =>
          patchEntry(current, entryId, {
            responseId: getResponseId(response),
            providerResponseId: getProviderResponseId(response),
            text,
            raw: JSON.stringify(response, null, 2),
            model: getModel(response),
            tools: getToolCalls(response),
            tokenCount: getTokenCount(response, text),
            latencyMs: performance.now() - startedAt,
            status: 'done',
          }),
        );

        return;
      }

      const stream = await client.responses.stream(request);
      let text = '';
      let raw = '';
      let responseId: string | null = null;
      let providerResponseId = previousProviderResponseId;
      let responseModel = `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`;
      let tools: ToolCall[] = [];

      for await (const event of stream as AsyncIterable<ResponsesStreamEvent>) {
        switch (event.type) {
          case 'response.output_text.delta':
            if (typeof event.delta === 'string') {
              text += event.delta;
            }
            break;
          case 'response.created':
          case 'response.in_progress':
          case 'response.completed':
            if (!isRecord(event.response)) {
              break;
            }

            responseId = typeof event.response.id === 'string' ? event.response.id : responseId;
            providerResponseId = getProviderResponseId(event.response) ?? providerResponseId;
            responseModel = getModel(event.response);
            tools = getToolCalls(event.response);

            if (event.type === 'response.completed') {
              const completedText = getOutputText(event.response);

              if (completedText) {
                text = completedText;
              }

              raw = JSON.stringify(event.response, null, 2);
            }
            break;
          default:
            break;
        }

        startTransition(() => {
          setTurns(current =>
            patchEntry(current, entryId, {
              responseId,
              providerResponseId,
              text,
              raw,
              model: responseModel,
              tools,
              tokenCount: raw ? getTokenCount(parseJson(raw), text) : estimateTokenCount(text),
              latencyMs: performance.now() - startedAt,
              status: event.type === 'response.completed' ? 'done' : 'pending',
            }),
          );
        });
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Request failed.';

      setError(message);
      setTurns(current =>
        patchEntry(current, entryId, {
          text: message,
          latencyMs: performance.now() - startedAt,
          status: 'error',
        }),
      );
    } finally {
      setMode('idle');
      setActiveRequest(null);
    }
  }

  const currentAnchor = [...turns].reverse().find(turn => turn.providerResponseId)?.providerResponseId ?? null;

  return (
    <section className="demo-main">
      <header className="demo-topbar">
        <div className="demo-topbar__leading">
          <div className="demo-brand">
            <span className="demo-brand__icon" aria-hidden="true">
              M
            </span>
            <div className="demo-brand__copy">
              <span className="demo-brand__name">Mastra Responses API Demo</span>
              <span className="demo-brand__label">Provider-backed Agent Responses</span>
            </div>
          </div>

          <p className="demo-brand__subtitle">
            Uses provider-managed continuation via `providerOptions.openai.previousResponseId`.
          </p>
        </div>

        <span className="demo-response-badge" title={currentAnchor ?? 'awaiting-provider'}>
          {truncateId(currentAnchor)}
        </span>
      </header>

      <div className="demo-thread">
        <span className="demo-thread__dot" aria-hidden="true" />
        <span>Turn {String(Math.max(turns.filter(turn => turn.status === 'done').length + (mode !== 'idle' ? 1 : 0), 1)).padStart(2, '0')}</span>
        <span className="demo-thread__separator" aria-hidden="true" />
        <span>{currentAnchor ? `next turn will use provider response ${truncateId(currentAnchor)}` : 'first provider response creates the continuation anchor'}</span>
      </div>

      <section className="demo-chat">
        <div className="demo-messages">
          {turns.length === 0 ? (
            <div className="demo-empty-state">
              <p>Each response returns the provider response ID, and the next turn sends it back through `providerOptions`.</p>
              <div className="demo-chip-list">
                {[
                  'Tell me three facts about Saturn.',
                  'Expand on the second fact.',
                  'Now turn that into a tweet thread.',
                ].map(prompt => (
                  <button key={prompt} className="demo-chip" onClick={() => setInput(prompt)} type="button">
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map(turn => {
              const isRawOpen = openRawTurnId === turn.id;

              return (
                <div className="demo-message-group" key={turn.id}>
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
                        <div className="demo-message__response-id">{turn.providerResponseId ?? 'awaiting provider response'}</div>

                        <div className="demo-message__actions">
                          <button
                            className="demo-toolbar-button"
                            disabled={!turn.raw}
                            onClick={() => setOpenRawTurnId(current => (current === turn.id ? null : turn.id))}
                            type="button"
                          >
                            {isRawOpen ? 'Hide JSON' : 'Raw JSON'}
                          </button>
                        </div>
                      </div>

                      <div className="demo-message__body">
                        {turn.tools.length > 0 ? (
                          <div className="demo-tools">
                            {turn.tools.map(tool => (
                              <div className="demo-tool" key={tool.id}>
                                <div className="demo-tool__header">
                                  <span className="demo-tool__name">{tool.name}</span>
                                  <span className="demo-tool__state">completed</span>
                                </div>
                                {tool.arguments !== undefined ? (
                                  <div className="demo-tool__section">
                                    <span className="demo-tool__label">Arguments</span>
                                    <pre className="demo-tool__value">
                                      {typeof tool.arguments === 'string' ? tool.arguments : JSON.stringify(tool.arguments, null, 2)}
                                    </pre>
                                  </div>
                                ) : null}
                                {tool.output !== undefined ? (
                                  <div className="demo-tool__section">
                                    <span className="demo-tool__label">Output</span>
                                    <pre className="demo-tool__value">
                                      {typeof tool.output === 'string' ? tool.output : JSON.stringify(tool.output, null, 2)}
                                    </pre>
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {turn.text ? (
                          <p className={turn.status === 'error' ? 'demo-turn__error' : 'demo-message__response'}>{turn.text}</p>
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
                        <span>{turn.tokenCount} tokens</span>
                        <span>{turn.mode === 'stream' ? 'stream' : 'send'}</span>
                      </div>

                      <div className={`demo-json-shell${isRawOpen ? ' is-open' : ''}`}>
                        <div className="demo-json-shell__inner">
                          <pre className="demo-json">
                            <code>{turn.raw || 'No response payload yet.'}</code>
                          </pre>
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
            aria-label="Write your prompt"
            placeholder="Write a one-sentence bedtime story about a unicorn..."
            onBlur={() => setIsInputFocused(false)}
            onChange={event => setInput(event.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onKeyDown={event => {
              if (event.nativeEvent.isComposing) {
                return;
              }

              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (mode === 'idle') {
                  void submit('json');
                }
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
                  disabled={mode !== 'idle' || input.trim().length === 0}
                  onClick={() => void submit('json')}
                  type="button"
                >
                  {mode === 'json' ? 'Sending...' : 'Send'}
                </button>
                <button
                  className="demo-button demo-button--secondary"
                  disabled={mode !== 'idle' || input.trim().length === 0}
                  onClick={() => void submit('stream')}
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
  );
}
