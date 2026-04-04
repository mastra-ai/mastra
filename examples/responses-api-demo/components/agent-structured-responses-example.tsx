'use client';

import type { CreateResponseParams, ResponsesStreamEvent } from '@mastra/client-js';
import { MastraClient } from '@mastra/client-js';
import { startTransition, useEffect, useState } from 'react';

const client = new MastraClient({
  baseUrl: process.env.NEXT_PUBLIC_MASTRA_BASE_URL ?? 'http://localhost:4111',
});

type Turn = {
  id: string;
  prompt: string;
  responseId: string | null;
  text: string;
  parsed: unknown;
  raw: string;
  model: string | null;
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
    return 'awaiting-agent';
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

function patchEntry(turns: Turn[], entryId: string, next: Partial<Turn>) {
  return turns.map(turn => (turn.id === entryId ? { ...turn, ...next } : turn));
}

export function AgentStructuredResponsesExample() {
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
        text: '',
        parsed: null,
        raw: '',
        model: null,
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
      instructions: 'Return a structured JSON object that matches the provided schema exactly.',
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_summary',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              priority: { type: 'string' },
              next_step: { type: 'string' },
            },
            required: ['summary', 'priority', 'next_step'],
            additionalProperties: false,
          },
        },
      },
      store: false,
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
            text,
            parsed: parseJson(text),
            raw: JSON.stringify(response, null, 2),
            model: getModel(response),
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
      let responseModel = `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`;
      let parsed: unknown = null;

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
            responseModel = getModel(event.response);

            if (event.type === 'response.completed') {
              const completedText = getOutputText(event.response);

              if (completedText) {
                text = completedText;
              }

              parsed = parseJson(text);
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
              text,
              parsed,
              raw,
              model: responseModel,
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
              <span className="demo-brand__label">Mastra Agent + Structured Output</span>
            </div>
          </div>

          <p className="demo-brand__subtitle">
            Uses `text.format.type = 'json_schema'` so the response comes back as structured JSON through the Responses
            API.
          </p>
        </div>

        <span className="demo-response-badge" title={turns.at(-1)?.responseId ?? 'awaiting-agent'}>
          {truncateId(turns.at(-1)?.responseId ?? null)}
        </span>
      </header>

      <div className="demo-thread">
        <span className="demo-thread__dot" aria-hidden="true" />
        <span>Structured Output</span>
        <span className="demo-thread__separator" aria-hidden="true" />
        <span>one request, one JSON schema, one structured response</span>
      </div>

      <section className="demo-chat">
        <div className="demo-messages">
          {turns.length === 0 ? (
            <div className="demo-empty-state">
              <p>
                These prompts send `text.format.type = 'json_schema'` so the agent returns a JSON object that matches
                the schema.
              </p>
              <div className="demo-chip-list">
                {[
                  'Summarize this support ticket: login page fails only on Safari and users need a workaround.',
                  'Turn this into a structured launch update for the team: docs done, QA blocked on one flaky test.',
                  'Classify this issue: checkout errors spike after deploy and rollback is ready.',
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
                        <div className="demo-message__response-id">{turn.responseId ?? 'awaiting response id'}</div>

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
                        {turn.parsed && turn.status !== 'error' ? (
                          <div className="demo-tool">
                            <div className="demo-tool__header">
                              <span className="demo-tool__name">Structured Output</span>
                              <span className="demo-tool__state">validated</span>
                            </div>
                            <div className="demo-tool__section">
                              <span className="demo-tool__label">JSON object</span>
                              <pre className="demo-tool__value">{JSON.stringify(turn.parsed, null, 2)}</pre>
                            </div>
                          </div>
                        ) : null}

                        {turn.status === 'pending' && turn.text ? (
                          <div className="demo-tool">
                            <div className="demo-tool__header">
                              <span className="demo-tool__name">Streaming JSON</span>
                              <span className="demo-tool__state">in progress</span>
                            </div>
                            <div className="demo-tool__section">
                              <span className="demo-tool__label">Text</span>
                              <pre className="demo-tool__value">{turn.text}</pre>
                            </div>
                          </div>
                        ) : null}

                        {turn.text && turn.status === 'error' ? (
                          <p className="demo-turn__error">{turn.text}</p>
                        ) : !turn.parsed && !turn.text ? (
                          <div className="demo-turn__pending">
                            <div className="demo-turn__shimmer" />
                            <div className="demo-turn__shimmer demo-turn__shimmer--short" />
                          </div>
                        ) : null}
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
            placeholder="Describe an issue or update to turn into structured JSON..."
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
