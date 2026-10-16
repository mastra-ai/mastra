import type {
  AssistantModelMessage,
  ModelMessage,
  ToolModelMessage,
  UserModelMessage,
  ProviderOptions,
} from '@internal/ai-v7';
import type { PersistableAction, SignalAction, ToolResultAction } from './types';
import { isReadableAction } from './types';

type AssistantPart = Exclude<AssistantModelMessage['content'], string>[number];
type ToolPart = ToolModelMessage['content'][number];
type UserPart = Exclude<UserModelMessage['content'], string>[number];
type ToolOutput = Extract<ToolPart, { type: 'tool-result' }>['output'];

/**
 * Projects a stored action log into a v7 prompt. Pure: same log, same prompt.
 * Consecutive actions of the same side are merged into one message; a `turn-start` closes the previous
 * assistant message so each model call maps to one assistant message (+ its tool message).
 */
export function toModelMessages(actions: PersistableAction[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  let current: UserModelMessage | AssistantModelMessage | ToolModelMessage | undefined;
  const providerExecuted = new Set<string>();

  function open<R extends 'user' | 'assistant' | 'tool'>(role: R) {
    if (current?.role !== role) {
      current = { role, content: [] } as unknown as typeof current;
      messages.push(current!);
    }
    return current as Extract<ModelMessage, { role: R }>;
  }
  const user = (part: UserPart) => (open('user').content as UserPart[]).push(part);
  const assistant = (part: AssistantPart) => (open('assistant').content as AssistantPart[]).push(part);
  const tool = (part: ToolPart) => open('tool').content.push(part);

  const outcomeFor = new Set<string>();
  const called = new Set<string>();
  const approvalFor = new Map<string, string>();
  for (const action of actions) {
    if (!isReadableAction(action)) continue;
    const providerOptions = action.providerMetadata as ProviderOptions | undefined;
    const opts = providerOptions ? { providerOptions } : {};
    switch (action.type) {
      case 'text':
      case 'file': {
        if (action.role === 'system') break;
        const part =
          action.type === 'text'
            ? ({ type: 'text', text: action.text, ...opts } as const)
            : ({
                type: 'file',
                data: toData(action.data),
                mediaType: action.mediaType,
                ...(action.filename ? { filename: action.filename } : {}),
                ...opts,
              } as const);
        if (action.role === 'user') user(part);
        else assistant(part);
        break;
      }
      case 'reasoning':
        assistant({ type: 'reasoning', text: action.text, ...opts });
        break;
      case 'reasoning-file':
        assistant({ type: 'reasoning-file', data: toData(action.data), mediaType: action.mediaType, ...opts });
        break;
      case 'tool-call':
        called.add(action.toolCallId);
        if (action.providerExecuted) providerExecuted.add(action.toolCallId);
        assistant({
          type: 'tool-call',
          toolCallId: action.toolCallId,
          toolName: action.toolName,
          input: action.input,
          ...(action.providerExecuted ? { providerExecuted: true } : {}),
          ...opts,
        });
        break;
      case 'tool-approval-requested':
        approvalFor.set(action.approvalId, action.toolCallId);
        assistant({ type: 'tool-approval-request', approvalId: action.approvalId, toolCallId: action.toolCallId });
        break;
      case 'tool-approval-responded':
        tool({
          type: 'tool-approval-response',
          approvalId: action.approvalId,
          approved: action.approved,
          ...(action.reason ? { reason: action.reason } : {}),
        });
        break;
      case 'tool-result':
      case 'tool-error':
      case 'tool-denied': {
        // One outcome per call. A second can only come from two writers on one thread (repair closing a run
        // that was still live); the contract is one writer, and a duplicate result would fail the prompt.
        if (outcomeFor.has(action.toolCallId)) break;
        outcomeFor.add(action.toolCallId);
        const part = {
          type: 'tool-result',
          toolCallId: action.toolCallId,
          toolName: action.toolName,
          output: toolOutput(action),
          ...opts,
        } as const;
        if (providerExecuted.has(action.toolCallId)) assistant(part);
        else tool(part);
        break;
      }
      case 'signal':
        user({ type: 'text', text: signalText(action) });
        // The text names each file in place; the files themselves follow it.
        for (const c of action.contents)
          if (c.type === 'file')
            user({
              type: 'file',
              data: toData(c.data),
              mediaType: c.mediaType,
              ...(c.filename ? { filename: c.filename } : {}),
            });
        break;
      case 'turn-start':
        if (current?.role === 'assistant' || current?.role === 'tool') current = undefined;
        break;
      // Lifecycle, bookkeeping, and UI-only content never reach the model.
      case 'run-start':
      case 'turn-end':
      case 'run-end':
      case 'run-aborted':
      case 'settings-changed':
      case 'task-changed':
      case 'goal-started':
      case 'goal-changed':
      case 'goal-ended':
      // Not projected until the goal loop runs on actions.
      case 'goal-evaluated':
      case 'tool-started':
      case 'provider-event':
      case 'model-changed':
      case 'structured-output':
      case 'thread-title-changed':
      case 'error':
      case 'file-unavailable':
      case 'source-url':
      case 'source-document':
      case 'memory-cycle-start':
      case 'memory-cycle-end':
      case 'memory-activated':
      case 'tool-suspended':
      case 'tool-resumed':
      case 'tool-delegated':
      case 'background-tool-dispatched':
      case 'background-tool-started':
      case 'background-tool-suspended':
      case 'background-tool-resumed':
      case 'background-tool-result':
      case 'background-tool-error':
      case 'background-tool-ended':
        break;
      default:
        // A type from a newer writer, or a custom `data-*` row: skipped.
        break;
    }
  }
  // A skipped row (one this reader can't read) can leave a call without its outcome or an outcome without its
  // call; providers reject either, so both halves go. A call waiting on an approval keeps its request.
  const awaiting = new Set(approvalFor.values());
  const paired = (part: { type: string; toolCallId?: string; approvalId?: string }): boolean => {
    switch (part.type) {
      case 'tool-call':
        return outcomeFor.has(part.toolCallId!) || awaiting.has(part.toolCallId!);
      case 'tool-result':
      case 'tool-approval-request':
        return called.has(part.toolCallId!);
      case 'tool-approval-response':
        return called.has(approvalFor.get(part.approvalId!) ?? '');
      default:
        return true;
    }
  };
  for (const message of messages)
    if (Array.isArray(message.content))
      message.content = (message.content as { type: string }[]).filter(paired) as typeof message.content;
  return messages.filter(m => !Array.isArray(m.content) || m.content.length > 0);
}

function toolOutput(action: PersistableAction & { type: 'tool-result' | 'tool-error' | 'tool-denied' }): ToolOutput {
  if (action.type === 'tool-error') return { type: 'error-text', value: action.errorText };
  if (action.type === 'tool-denied')
    return { type: 'execution-denied', ...(action.reason ? { reason: action.reason } : {}) };
  const { modelOutput, output } = action as ToolResultAction;
  if (modelOutput) return modelOutput as ToolOutput;
  if (typeof output === 'string') return { type: 'text', value: output };
  return { type: 'json', value: (output ?? null) as Extract<ToolOutput, { type: 'json' }>['value'] };
}

function toData(data: string): string | URL {
  return /^(https?:|data:)/.test(data) ? new URL(data) : data;
}

function signalText(signal: SignalAction): string {
  const body = signal.contents
    .map(c => (c.type === 'text' ? c.text : `[file ${c.filename ?? c.mediaType}]`))
    .join('\n');
  if (!signal.tagName) return body;
  const attrs = Object.entries(signal.attributes ?? {})
    .map(([k, v]) => ` ${k}="${String(v)}"`)
    .join('');
  return `<${signal.tagName}${attrs}>${body}</${signal.tagName}>`;
}
