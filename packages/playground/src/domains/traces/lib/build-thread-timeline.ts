export type TimelineSpan = {
  spanId: string;
  name?: string | null;
  spanType?: string | null;
  parentSpanId?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  attributes?: Record<string, unknown> | null;
  input?: unknown;
  inputPreview?: unknown;
  output?: unknown;
  error?: unknown;
  startedAt?: string | Date | null;
  endedAt?: string | Date | null;
};

export type ThreadTimeline = {
  /** The user message that opened this turn, when we could extract one. */
  userTurn?: string;
  /** Significant steps, flattened and sorted chronologically. */
  entries: TimelineSpan[];
  /** Number of spans skipped because their type is not on the allowlist. */
  hiddenCount: number;
  /** Epoch ms the turn started, used as the `0.0s` origin of the gutter. */
  turnStart?: number;
  /** The agent's final answer, closing the turn. */
  answer?: string;
  /** Epoch ms the turn ended, used to place the answer on the gutter. */
  answerAt?: number;
};

/** Decision 2: allowlist of span types rendered in the thread view. */
export const RENDERED_SPAN_TYPES = [
  'model_generation',
  'tool_call',
  'client_tool_call',
  'provider_tool_call',
  'mcp_tool_call',
  'processor_run',
  'workflow_run',
  'workflow_step',
  'workspace_action',
] as const;

const RENDERED = new Set<string>(RENDERED_SPAN_TYPES);

/**
 * Infrastructure processors that describe how the agent is wired, not what it did.
 * They are noise in a conversation-shaped view, so they are hidden like out-of-allowlist spans.
 */
export const HIDDEN_PROCESSOR_SLUGS = [
  'task-state',
  'observational-memory',
  'workspace-instructions',
  'skills-processor',
] as const;

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function isHiddenProcessor(span: TimelineSpan): boolean {
  if (span.spanType !== 'processor_run') return false;
  const identifier = [span.entityId, span.name].filter(Boolean).join(' ');
  if (!identifier) return false;
  const slug = slugify(identifier);
  return HIDDEN_PROCESSOR_SLUGS.some(hidden => slug.includes(hidden));
}

function toTime(value: TimelineSpan['startedAt']): number {
  if (!value) return 0;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function textFromContent(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const text = content
      .map(part =>
        part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
          ? (part as { text: string }).text
          : '',
      )
      .filter(Boolean)
      .join(' ')
      .trim();
    return text || undefined;
  }
  return undefined;
}

/** Extracts the user message from an `agent_run` span input (string | string[] | messages[]). */
export function extractUserTurn(input: unknown): string | undefined {
  if (typeof input === 'string') return input || undefined;

  if (Array.isArray(input)) {
    const messages = [...input].reverse();
    for (const message of messages) {
      if (typeof message === 'string') return message || undefined;
      if (message && typeof message === 'object') {
        const { role, content } = message as { role?: unknown; content?: unknown };
        if (role !== undefined && role !== 'user') continue;
        const text = textFromContent(content);
        if (text) return text;
      }
    }
    return undefined;
  }

  if (input && typeof input === 'object') {
    return extractUserTurn((input as { messages?: unknown }).messages);
  }

  return undefined;
}

/** Extracts the agent's final answer from an `agent_run` (or `model_generation`) output. */
export function extractAnswer(output: unknown): string | undefined {
  if (typeof output === 'string') return output.trim() || undefined;

  if (Array.isArray(output)) {
    const messages = [...output].reverse();
    for (const message of messages) {
      if (typeof message === 'string') return message.trim() || undefined;
      if (message && typeof message === 'object') {
        const { role, content, text } = message as { role?: unknown; content?: unknown; text?: unknown };
        if (role !== undefined && role !== 'assistant') continue;
        const found = textFromContent(content) ?? (typeof text === 'string' ? text : undefined);
        if (found) return found.trim();
      }
    }
    return undefined;
  }

  if (output && typeof output === 'object') {
    const record = output as Record<string, unknown>;
    for (const key of ['text', 'content', 'messages', 'response', 'result']) {
      const found = extractAnswer(record[key]);
      if (found) return found;
    }
  }

  return undefined;
}

function toOptionalTime(value: TimelineSpan['startedAt']): number | undefined {
  if (!value) return undefined;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}

export function buildThreadTimeline(spans: TimelineSpan[] | null | undefined): ThreadTimeline {
  const all = spans ?? [];
  const rootAgentRun =
    all.find(span => span.spanType === 'agent_run' && !span.parentSpanId) ??
    all.find(span => span.spanType === 'agent_run');

  const entries = all
    .filter(span => RENDERED.has(span.spanType ?? '') && !isHiddenProcessor(span))
    .sort((a, b) => toTime(a.startedAt) - toTime(b.startedAt));

  // The user message is not always on `agent_run.input`. Resolution order, most structured first:
  // `input` (the messages passed to the agent), then `AgentRunAttributes.prompt`, then the light
  // projection's preview, then the input of a `model_generation` span — the in-process loop opens
  // it with `{ messages: [...systemMessages, ...messages] }` (`llm/model/model.loop.ts:176`), so it
  // replays the conversation. The durable path opens it without input, hence it is only a fallback.
  const userTurn =
    extractUserTurn(rootAgentRun?.input) ??
    extractUserTurn(rootAgentRun?.attributes?.prompt) ??
    extractUserTurn(rootAgentRun?.inputPreview) ??
    entries.reduce<string | undefined>(
      (found, span) => found ?? (span.spanType === 'model_generation' ? extractUserTurn(span.input) : undefined),
      undefined,
    );

  const lastModelGeneration = [...entries].reverse().find(span => span.spanType === 'model_generation');
  const answer = extractAnswer(rootAgentRun?.output) ?? extractAnswer(lastModelGeneration?.output);

  return {
    userTurn,
    entries,
    hiddenCount: all.length - entries.length - (rootAgentRun ? 1 : 0),
    turnStart: toOptionalTime(rootAgentRun?.startedAt) ?? toOptionalTime(entries[0]?.startedAt),
    answer,
    answerAt: toOptionalTime(rootAgentRun?.endedAt) ?? toOptionalTime(lastModelGeneration?.endedAt),
  };
}
