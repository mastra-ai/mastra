import { buildSpanTree, flattenSpanTree, type SpanNode } from '@mastra/playground-ui/domains/traces/components';

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
  /**
   * Every span of the trace, as the tree its `parentSpanId` links already describe. Renderers walk
   * it so a span can decide how its own subtree is displayed.
   */
  entries: SpanNode<TimelineSpan>[];
  /** Epoch ms the turn started, used as the `0.0s` origin of the gutter. */
  turnStart?: number;
  /** The agent's final answer, closing the turn. */
  answer?: string;
  /** Epoch ms the turn ended, used to place the answer on the gutter. */
  answerAt?: number;
  /**
   * The root `agent_run` the answer closes. It carries no row of its own, so the answer stands in
   * for it — comments left on the answer are span-scoped to the run that produced it. Undefined
   * when the answer came from the `model_generation` fallback, which is not a stable anchor.
   */
  answerSpanId?: string;
};

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

/**
 * The span types the conversation is made of: what the model said, what it called, and the business
 * steps around them. Everything else — `model_chunk`, `model_step`, and the rest of the streaming
 * mechanics — describes how the answer was produced, not what happened in the exchange.
 */
const CONVERSATION_SPAN_TYPES = new Set([
  'model_generation',
  'tool_call',
  'client_tool_call',
  'provider_tool_call',
  'mcp_tool_call',
  'processor_run',
  'workflow_run',
  'workflow_step',
  'workspace_action',
]);

/**
 * Processors that maintain the agent rather than serve the exchange. Applicative ones (moderation,
 * PII detection…) are kept: they act on the conversation, and can even end it on a tripwire.
 */
const PLUMBING_PROCESSORS = ['taskstate', 'observationalmemory', 'workspaceinstructions', 'skillsprocessor'];

/** Lowercased alphanumerics, so `Observational Memory` and `ObservationalMemoryProcessor` meet. */
const compact = (value: unknown): string =>
  typeof value === 'string' ? value.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

function isPlumbing(span: TimelineSpan): boolean {
  if (span.spanType !== 'processor_run') return false;
  const identity = `${compact(span.entityId)} ${compact(span.name)}`;
  return PLUMBING_PROCESSORS.some(processor => identity.includes(processor));
}

/**
 * Keeps the conversation out of the raw trace, with two distinct gestures:
 *
 * - a span that is not part of the conversation is **dropped, its children promoted** — a tool call
 *   reached through a `model_step` is still a tool call, and `agent_run` is the turn itself rather
 *   than a step within it, already told by the USER and ANSWER rows;
 * - a plumbing processor is **dropped with its whole subtree** — the observer agent's own model
 *   generations are not moments of this conversation, and must not be mistaken for its answer.
 */
function keepConversation(nodes: SpanNode<TimelineSpan>[]): SpanNode<TimelineSpan>[] {
  return nodes.flatMap(node => {
    if (isPlumbing(node.span)) return [];

    const children = keepConversation(node.children);
    if (!CONVERSATION_SPAN_TYPES.has(node.span.spanType ?? '')) return children;

    return [{ ...node, children }];
  });
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

  // The tree is built from the whole trace, then pruned: parentage has to be known before deciding
  // what a node's removal does to its descendants.
  const entries = keepConversation(buildSpanTree(all));
  const ordered = flattenSpanTree(entries);

  // The user message is not always on `agent_run.input`. Resolution order, most structured first:
  // `input` (the messages passed to the agent), then `AgentRunAttributes.prompt`, then the light
  // projection's preview, then the input of a `model_generation` span — the in-process loop opens
  // it with `{ messages: [...systemMessages, ...messages] }` (`llm/model/model.loop.ts:176`), so it
  // replays the conversation. The durable path opens it without input, hence it is only a fallback.
  const userTurn =
    extractUserTurn(rootAgentRun?.input) ??
    extractUserTurn(rootAgentRun?.attributes?.prompt) ??
    extractUserTurn(rootAgentRun?.inputPreview) ??
    ordered.reduce<string | undefined>(
      (found, span) => found ?? (span.spanType === 'model_generation' ? extractUserTurn(span.input) : undefined),
      undefined,
    );

  const lastModelGeneration = [...ordered].reverse().find(span => span.spanType === 'model_generation');
  const rootAnswer = extractAnswer(rootAgentRun?.output);
  const answer = rootAnswer ?? extractAnswer(lastModelGeneration?.output);

  return {
    userTurn,
    entries,
    turnStart: toOptionalTime(rootAgentRun?.startedAt) ?? toOptionalTime(ordered[0]?.startedAt),
    answer,
    answerAt: toOptionalTime(rootAgentRun?.endedAt) ?? toOptionalTime(lastModelGeneration?.endedAt),
    answerSpanId: rootAnswer === undefined ? undefined : rootAgentRun?.spanId,
  };
}
