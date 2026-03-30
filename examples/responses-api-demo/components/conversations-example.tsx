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
  text: string;
  raw: string;
  model: string | null;
  tools: ToolCall[];
  tokenCount: number;
  latencyMs: number | null;
  mode: 'json' | 'stream';
  status: 'pending' | 'done' | 'error';
};

type ConversationSummary = {
  id: string;
  title: string;
  subtitle: string;
};

function createTurnId() {
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

function formatConversationTime(value: string | Date | null | undefined) {
  if (!value) {
    return 'No activity yet';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'No activity yet';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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

function getConversationId(payload: unknown) {
  if (isRecord(payload) && typeof payload.conversation_id === 'string') {
    return payload.conversation_id;
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

function getToolCalls(payload: unknown): ToolCall[] {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    return [];
  }

  const calls = new Map<string, ToolCall>();

  for (const item of payload.output) {
    if (!isRecord(item) || typeof item.type !== 'string') {
      continue;
    }

    if (item.type === 'function_call' && typeof item.call_id === 'string' && typeof item.name === 'string') {
      calls.set(item.call_id, {
        id: item.call_id,
        name: item.name,
        arguments: typeof item.arguments === 'string' ? parseJson(item.arguments) : undefined,
        output: calls.get(item.call_id)?.output,
      });
    }

    if (item.type === 'function_call_output' && typeof item.call_id === 'string') {
      const existing = calls.get(item.call_id);

      calls.set(item.call_id, {
        id: item.call_id,
        name: existing?.name ?? 'Tool',
        arguments: existing?.arguments,
        output: typeof item.output === 'string' ? parseJson(item.output) : item.output,
      });
    }
  }

  return [...calls.values()];
}

function patchTurn(turns: Turn[], turnId: string, next: Partial<Turn>) {
  return turns.map(turn => (turn.id === turnId ? { ...turn, ...next } : turn));
}

function getConversationTitle(prompt: string) {
  const trimmed = prompt.trim();

  if (!trimmed) {
    return 'New conversation';
  }

  return trimmed.length > 52 ? `${trimmed.slice(0, 49)}...` : trimmed;
}

function buildTurnsFromItems(items: any[]) {
  const turns: Turn[] = [];
  let pendingPrompt = '';
  const pendingTools = new Map<string, ToolCall>();

  for (const item of items) {
    if (!isRecord(item) || typeof item.type !== 'string') {
      continue;
    }

    if (item.type === 'function_call' && typeof item.call_id === 'string' && typeof item.name === 'string') {
      pendingTools.set(item.call_id, {
        id: item.call_id,
        name: item.name,
        arguments: typeof item.arguments === 'string' ? parseJson(item.arguments) : undefined,
      });
      continue;
    }

    if (item.type === 'function_call_output' && typeof item.call_id === 'string') {
      const existing = pendingTools.get(item.call_id);

      pendingTools.set(item.call_id, {
        id: item.call_id,
        name: existing?.name ?? 'Tool',
        arguments: existing?.arguments,
        output: typeof item.output === 'string' ? parseJson(item.output) : item.output,
      });
      continue;
    }

    if (item.type !== 'message') {
      continue;
    }

    if (item.role === 'user') {
      pendingPrompt = Array.isArray(item.content)
        ? item.content
            .map(part => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
            .join('')
        : '';
      continue;
    }

    if (item.role !== 'assistant') {
      continue;
    }

    const text = Array.isArray(item.content)
      ? item.content
          .map(part => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
          .join('')
      : '';

    turns.push({
      id: typeof item.id === 'string' ? item.id : createTurnId(),
      prompt: pendingPrompt,
      responseId: typeof item.id === 'string' ? item.id : null,
      text,
      raw: JSON.stringify({ message: item, tools: [...pendingTools.values()] }, null, 2),
      model: `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`,
      tools: [...pendingTools.values()],
      tokenCount: estimateTokenCount(text),
      latencyMs: null,
      mode: 'json',
      status: 'done',
    });

    pendingPrompt = '';
    pendingTools.clear();
  }

  return turns;
}

function summarizeThread(thread: any, index: number): ConversationSummary {
  return {
    id: typeof thread?.id === 'string' ? thread.id : `conversation-${index + 1}`,
    title: typeof thread?.title === 'string' && thread.title.trim() ? thread.title.trim() : `Conversation ${index + 1}`,
    subtitle: formatConversationTime(thread?.updatedAt),
  };
}

export function ConversationsExample() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [mode, setMode] = useState<'idle' | 'json' | 'stream'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [openRawTurnId, setOpenRawTurnId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [activeRequest, setActiveRequest] = useState<{ turnId: string; startedAt: number } | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadConversations() {
      setIsLoadingConversations(true);

      try {
        const response = await client.listMemoryThreads({
          agentId: 'support-agent',
          page: 0,
          perPage: 50,
          orderBy: 'updatedAt',
          sortDirection: 'DESC',
        });

        if (cancelled) {
          return;
        }

        const nextConversations = response.threads.map(summarizeThread);
        setConversations(nextConversations);
        setActiveConversationId(current => current ?? nextConversations[0]?.id ?? null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load conversations.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingConversations(false);
        }
      }
    }

    void loadConversations();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadConversationItems() {
      if (!activeConversationId) {
        setTurns([]);
        return;
      }

      setIsLoadingItems(true);

      try {
        const response = await client.conversations.items.list(activeConversationId);

        if (!cancelled) {
          setTurns(buildTurnsFromItems(response.data));
          setOpenRawTurnId(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load conversation items.');
          setTurns([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingItems(false);
        }
      }
    }

    void loadConversationItems();

    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeRequest) {
      return;
    }

    const interval = window.setInterval(() => {
      setTurns(current =>
        patchTurn(current, activeRequest.turnId, {
          latencyMs: performance.now() - activeRequest.startedAt,
          tokenCount: estimateTokenCount(current.find(turn => turn.id === activeRequest.turnId)?.text ?? ''),
        }),
      );
    }, 120);

    return () => window.clearInterval(interval);
  }, [activeRequest]);

  async function createConversation() {
    if (mode !== 'idle' || isCreatingConversation) {
      return;
    }

    setIsCreatingConversation(true);
    setError(null);

    try {
      const conversation = await client.conversations.create({
        agent_id: 'support-agent',
        title: 'New conversation',
      });

      const summary = summarizeThread(conversation.thread, 0);
      setConversations(current => [summary, ...current.filter(item => item.id !== summary.id)]);
      setActiveConversationId(conversation.id);
      setTurns([]);
      setOpenRawTurnId(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create conversation.');
    } finally {
      setIsCreatingConversation(false);
    }
  }

  async function deleteConversation() {
    if (!activeConversationId || mode !== 'idle' || isDeletingConversation) {
      return;
    }

    setIsDeletingConversation(true);
    setError(null);

    try {
      await client.conversations.delete(activeConversationId);

      const remainingConversations = conversations.filter(conversation => conversation.id !== activeConversationId);
      setConversations(remainingConversations);
      setActiveConversationId(remainingConversations[0]?.id ?? null);
      setTurns([]);
      setOpenRawTurnId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete conversation.');
    } finally {
      setIsDeletingConversation(false);
    }
  }

  async function submit(nextMode: 'json' | 'stream') {
    const prompt = input.trim();

    if (!prompt) {
      return;
    }

    const previousResponseId = turns.at(-1)?.responseId ?? null;
    const turnId = createTurnId();
    const startedAt = performance.now();

    setError(null);
    setMode(nextMode);
    setOpenRawTurnId(null);
    setActiveRequest({ turnId, startedAt });
    setTurns(current => [
      ...current,
      {
        id: turnId,
        prompt,
        responseId: null,
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

    let conversationId = activeConversationId;

    if (!conversationId) {
      const conversation = await client.conversations.create({
        agent_id: 'support-agent',
        title: getConversationTitle(prompt),
      });

      const summary = summarizeThread(conversation.thread, 0);
      setConversations(current => [summary, ...current.filter(item => item.id !== summary.id)]);
      setActiveConversationId(conversation.id);
      conversationId = conversation.id;
    }

    const request = {
      model: `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`,
      agent_id: 'support-agent',
      input: prompt,
      instructions: 'You are a memory-backed Mastra agent. Keep the conversation coherent across stored turns.',
      store: true,
      conversation_id: conversationId,
      previous_response_id: previousResponseId ?? undefined,
    } satisfies CreateResponseParams;

    try {
      if (nextMode === 'json') {
        const response = await client.responses.create({
          ...request,
          stream: false,
        });

        const text = getOutputText(response);

        setTurns(current =>
          patchTurn(current, turnId, {
            responseId: getResponseId(response),
            text,
            raw: JSON.stringify(response, null, 2),
            model: getModel(response),
            tools: getToolCalls(response),
            tokenCount: getTokenCount(response, text),
            latencyMs: performance.now() - startedAt,
            status: 'done',
          }),
        );

        if (conversationId) {
          setConversations(current =>
            current.map(conversation =>
              conversation.id === conversationId
                ? {
                    ...conversation,
                    title: conversation.title === 'New conversation' ? getConversationTitle(prompt) : conversation.title,
                    subtitle: 'Updated just now',
                  }
                : conversation,
            ),
          );
        }

        return;
      }

      const stream = await client.responses.stream(request);
      let text = '';
      let raw = '';
      let responseId = previousResponseId;
      let responseModel = `openai/${process.env.NEXT_PUBLIC_AGENT_MODEL ?? 'gpt-4.1-mini'}`;
      let tools: ToolCall[] = [];

      for await (const event of stream as AsyncIterable<ResponsesStreamEvent>) {
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          text += event.delta;
        }

        if (
          (event.type === 'response.created' || event.type === 'response.in_progress' || event.type === 'response.completed') &&
          isRecord(event.response)
        ) {
          responseId = typeof event.response.id === 'string' ? event.response.id : responseId;
          responseModel = getModel(event.response);
          tools = getToolCalls(event.response);

          if (event.type === 'response.completed') {
            const completedText = getOutputText(event.response);

            if (completedText) {
              text = completedText;
            }

            raw = JSON.stringify(event.response, null, 2);

            const nextConversationId = getConversationId(event.response);
            if (nextConversationId) {
              setActiveConversationId(nextConversationId);
            }
          }
        }

        startTransition(() => {
          setTurns(current =>
            patchTurn(current, turnId, {
              responseId,
              text,
              raw,
              model: responseModel,
              tools,
              tokenCount: raw ? getTokenCount(JSON.parse(raw) as unknown, text) : estimateTokenCount(text),
              latencyMs: performance.now() - startedAt,
              status: event.type === 'response.completed' ? 'done' : 'pending',
            }),
          );
        });
      }

      if (conversationId) {
        setConversations(current =>
          current.map(conversation =>
            conversation.id === conversationId
              ? {
                  ...conversation,
                  title: conversation.title === 'New conversation' ? getConversationTitle(prompt) : conversation.title,
                  subtitle: 'Updated just now',
                }
              : conversation,
          ),
        );
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Request failed.';

      setError(message);
      setTurns(current =>
        patchTurn(current, turnId, {
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

  const currentAnchor = turns.at(-1)?.responseId ?? null;

  return (
    <>
      <section className="demo-main">
        <header className="demo-topbar">
          <div className="demo-topbar__leading">
            <div className="demo-brand">
              <span className="demo-brand__icon" aria-hidden="true">
                M
              </span>
              <div className="demo-brand__copy">
                <span className="demo-brand__name">Mastra Responses API Demo</span>
                <span className="demo-brand__label">Conversations</span>
              </div>
            </div>

            <p className="demo-brand__subtitle">
              Create or select a conversation, then continue the same stored thread with `conversation_id`.
            </p>
          </div>

          <span className="demo-response-badge" title={currentAnchor ?? activeConversationId ?? 'awaiting-agent'}>
            {truncateId(currentAnchor ?? activeConversationId)}
          </span>
        </header>

        <div className="demo-thread">
          <span className="demo-thread__dot" aria-hidden="true" />
          <span>Turn {String(Math.max(turns.filter(turn => turn.status === 'done').length + (mode !== 'idle' ? 1 : 0), 1)).padStart(2, '0')}</span>
          <span className="demo-thread__separator" aria-hidden="true" />
          <span>{activeConversationId ? `conversation ${truncateId(activeConversationId)}` : 'create a conversation or send the first stored turn'}</span>
        </div>

        <section className="demo-chat">
          <div className="demo-messages">
            {isLoadingItems ? (
              <div className="demo-empty-state">
                <p>Loading conversation messages...</p>
              </div>
            ) : turns.length === 0 ? (
              <div className="demo-empty-state">
                <p>Create a conversation or select one from the right to start chatting.</p>
                <div className="demo-chip-list">
                  {[
                    'Start a new planning conversation for an API launch.',
                    'Summarize what we have decided so far.',
                    'Turn the plan into a short checklist.',
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
                          <div className="demo-message__response-id">{turn.responseId ?? 'awaiting stored response'}</div>

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

      <aside className="demo-conversations">
        <div className="demo-conversations__header">
          <span className="demo-sidebar__eyebrow">Conversations</span>
          <div className="demo-actions__buttons">
            {activeConversationId ? (
              <button
                className="demo-button demo-button--secondary"
                disabled={mode !== 'idle' || isDeletingConversation}
                onClick={() => void deleteConversation()}
                type="button"
              >
                {isDeletingConversation ? 'Deleting...' : 'Delete'}
              </button>
            ) : null}
            <button
              className="demo-conversations__create"
              disabled={mode !== 'idle' || isCreatingConversation}
              onClick={() => void createConversation()}
              type="button"
              aria-label="Create conversation"
              title="Create conversation"
            >
              {isCreatingConversation ? '…' : '+'}
            </button>
          </div>
        </div>

        <div className="demo-conversations__list" aria-label="Conversations">
          {isLoadingConversations ? (
            <div className="demo-conversations__empty">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="demo-conversations__empty">No conversations yet.</div>
          ) : (
            conversations.map(conversation => (
              <button
                key={conversation.id}
                className={`demo-conversation-item${conversation.id === activeConversationId ? ' is-active' : ''}`}
                disabled={mode !== 'idle'}
                onClick={() => setActiveConversationId(conversation.id)}
                type="button"
              >
                <span className="demo-conversation-item__title">{conversation.title}</span>
                <span className="demo-conversation-item__subtitle">{conversation.subtitle}</span>
                <span className="demo-conversation-item__id">{conversation.id}</span>
              </button>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
