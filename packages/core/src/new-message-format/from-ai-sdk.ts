import type { LanguageModelUsage, ProviderMetadata, TextStreamPart, ToolSet } from '@internal/ai-v7';
import type { ActionBase, MastraAction, Usage } from './types';
import { ToolNotStartedError } from './types';

type Context = Pick<ActionBase, 'threadId' | 'resourceId' | 'runId'> & {
  modelId: string;
  generateId: () => string;
  /**
   * Set by the converter: returns the text and reasoning blocks still open, marked `interrupted`, and
   * closes them. For a consumer that stops reading early, so the text streamed so far isn't lost.
   */
  open?: { drain?: () => MastraAction[] };
};

/**
 * Converts an AI SDK v7 `fullStream` into actions as they happen. Deltas are yielded as transient
 * actions; each `*-end` yields the finished, persistable action that carries the same `contentId`.
 */
export async function* streamActions(
  stream: AsyncIterable<TextStreamPart<ToolSet>>,
  ctx: Context,
): AsyncGenerator<MastraAction> {
  const base = (): ActionBase => ({
    id: ctx.generateId(),
    threadId: ctx.threadId,
    createdAt: new Date(),
    ...(ctx.resourceId !== undefined ? { resourceId: ctx.resourceId } : {}),
    ...(ctx.runId !== undefined ? { runId: ctx.runId } : {}),
  });
  // AI SDK part id -> { contentId, accumulated text }
  const open = new Map<string, { contentId: string; text: string; kind: 'text' | 'reasoning' }>();
  const toolNames = new Map<string, string>();
  // Blocks the stream left open when it stopped (abort, error): stored with the text that arrived.
  function* interrupted(): Generator<MastraAction> {
    for (const [partId, block] of open) {
      open.delete(partId);
      if (!block.text) continue;
      const { contentId, text, kind } = block;
      yield { ...base(), type: kind, role: 'assistant', text, contentId, interrupted: true };
    }
  }
  if (ctx.open) ctx.open.drain = () => [...interrupted()];
  const failed: { error?: unknown } = {};

  for await (const part of untilError(stream, failed)) {
    switch (part.type) {
      case 'start-step':
        yield { ...base(), type: 'turn-start', modelId: ctx.modelId };
        break;
      case 'text-start':
      case 'reasoning-start': {
        const start = base();
        open.set(part.id, { contentId: start.id, text: '', kind: part.type === 'text-start' ? 'text' : 'reasoning' });
        yield { ...start, type: part.type, transient: true, contentId: start.id };
        break;
      }
      case 'text-delta':
      case 'reasoning-delta': {
        const block = open.get(part.id)!;
        block.text += part.text;
        yield { ...base(), type: part.type, transient: true, contentId: block.contentId, delta: part.text };
        break;
      }
      case 'text-end':
      case 'reasoning-end': {
        const block = open.get(part.id)!;
        open.delete(part.id);
        // Empty text blocks carry nothing; empty reasoning is kept because its provider metadata is replayed.
        if (part.type === 'text-end' && block.text === '') break;
        yield {
          ...base(),
          type: part.type === 'text-end' ? 'text' : 'reasoning',
          role: 'assistant',
          text: block.text,
          contentId: block.contentId,
          ...meta(part.providerMetadata),
        };
        break;
      }
      case 'tool-input-start':
        toolNames.set(part.id, part.toolName);
        yield { ...base(), type: 'tool-input-start', transient: true, toolCallId: part.id, toolName: part.toolName };
        break;
      case 'tool-input-delta':
        yield {
          ...base(),
          type: 'tool-input-delta',
          transient: true,
          toolCallId: part.id,
          toolName: toolNames.get(part.id) ?? '',
          delta: part.delta,
        };
        break;
      case 'tool-call':
        yield {
          ...base(),
          type: 'tool-call',
          role: 'assistant',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          input: part.input,
          ...(part.providerExecuted ? { providerExecuted: true } : {}),
        };
        break;
      case 'tool-result':
        yield part.preliminary
          ? {
              ...base(),
              type: 'tool-output-delta',
              transient: true,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            }
          : {
              ...base(),
              type: 'tool-result',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              output: part.output,
            };
        break;
      case 'tool-approval-request':
        yield {
          ...base(),
          type: 'tool-approval-requested',
          toolCallId: part.toolCall.toolCallId,
          toolName: part.toolCall.toolName,
          approvalId: part.approvalId,
        };
        break;
      case 'tool-approval-response':
        yield {
          ...base(),
          type: 'tool-approval-responded',
          toolCallId: part.toolCall.toolCallId,
          toolName: part.toolCall.toolName,
          approvalId: part.approvalId,
          approved: part.approved,
          ...(part.reason !== undefined ? { reason: part.reason } : {}),
        };
        break;
      case 'tool-output-denied':
        yield { ...base(), type: 'tool-denied', toolCallId: part.toolCallId, toolName: part.toolName };
        break;
      case 'tool-error':
        yield {
          ...base(),
          type: 'tool-error',
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          errorText: part.error instanceof Error ? part.error.message : String(part.error),
          ...(part.error instanceof ToolNotStartedError ? { code: 'TOOL_NOT_STARTED' as const } : {}),
        };
        break;
      case 'source':
        yield part.sourceType === 'url'
          ? { ...base(), type: 'source-url', role: 'assistant', sourceId: part.id, url: part.url, title: part.title }
          : {
              ...base(),
              type: 'source-document',
              role: 'assistant',
              sourceId: part.id,
              mediaType: part.mediaType,
              title: part.title,
              filename: part.filename,
            };
        break;
      case 'file':
        yield {
          ...base(),
          type: 'file',
          role: 'assistant',
          mediaType: part.file.mediaType,
          data: part.file.base64,
          ...meta(part.providerMetadata),
        };
        break;
      case 'error': {
        const error = part.error instanceof Error ? part.error : new Error(String(part.error));
        yield* interrupted();
        yield {
          ...base(),
          type: 'error',
          error: { name: error.name, message: error.message },
          source: { kind: 'model', modelId: ctx.modelId },
          fatal: true,
        };
        break;
      }
      case 'reasoning-file':
        yield {
          ...base(),
          type: 'reasoning-file',
          role: 'assistant',
          mediaType: part.file.mediaType,
          data: part.file.base64,
          ...meta(part.providerMetadata),
        };
        break;
      case 'finish-step':
        yield {
          ...base(),
          type: 'turn-end',
          finishReason: part.finishReason,
          usage: toUsage(part.usage),
          modelId: part.response.modelId,
          responseId: part.response.id,
          ...meta(part.providerMetadata),
        };
        break;
      case 'finish':
        yield { ...base(), type: 'run-end', finishReason: part.finishReason, usage: toUsage(part.totalUsage) };
        break;
      case 'abort':
        yield* interrupted();
        yield { ...base(), type: 'run-aborted', ...(part.reason !== undefined ? { reason: part.reason } : {}) };
        break;
      case 'custom':
        yield { ...base(), type: 'provider-event', kind: part.kind, ...meta(part.providerMetadata) };
        break;
      case 'raw':
        yield { ...base(), type: 'raw-chunk', transient: true, rawValue: part.rawValue };
        break;
      // Stream framing: the run starts with the user's input; tool input is captured whole by `tool-call`.
      case 'start':
      case 'tool-input-end':
        break;
      default: {
        // Exhaustive at compile time. At runtime a newer SDK may send parts this version doesn't know;
        // skip them rather than fail the run.
        const _unhandled: never = part;
        void _unhandled;
        break;
      }
    }
  }
  if ('error' in failed) {
    yield* interrupted();
    throw failed.error;
  }
}

/** Iterates `stream`, ending quietly on an error and leaving it in `failed` for the caller to rethrow. */
async function* untilError<T>(stream: AsyncIterable<T>, failed: { error?: unknown }): AsyncGenerator<T> {
  try {
    yield* stream;
  } catch (error) {
    failed.error = error;
  }
}

/** Drains a stream into the full action list (transient actions included). */
export async function actionsFromAISDKStream(
  stream: AsyncIterable<TextStreamPart<ToolSet>>,
  ctx: Context,
): Promise<MastraAction[]> {
  const actions: MastraAction[] = [];
  for await (const action of streamActions(stream, ctx)) actions.push(action);
  return actions;
}

function meta(providerMetadata: ProviderMetadata | undefined) {
  return providerMetadata ? { providerMetadata: providerMetadata as ActionBase['providerMetadata'] } : {};
}

function toUsage(usage: LanguageModelUsage): Usage {
  const out: Usage = {};
  if (usage.inputTokens !== undefined) out.inputTokens = usage.inputTokens;
  if (usage.outputTokens !== undefined) out.outputTokens = usage.outputTokens;
  if (usage.outputTokenDetails.reasoningTokens !== undefined)
    out.reasoningTokens = usage.outputTokenDetails.reasoningTokens;
  if (usage.inputTokenDetails.cacheReadTokens !== undefined)
    out.cacheReadTokens = usage.inputTokenDetails.cacheReadTokens;
  if (usage.inputTokenDetails.cacheWriteTokens !== undefined)
    out.cacheWriteTokens = usage.inputTokenDetails.cacheWriteTokens;
  return out;
}
