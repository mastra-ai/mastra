import type {
  AssistantModelMessage,
  ModelMessage,
  ToolModelMessage,
  UserModelMessage,
  ProviderOptions,
} from '@internal/ai-v7';
import type { PersistableAction, SignalAction, ToolResultAction } from './types';

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

  for (const action of actions) {
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
        break;
      case 'turn-start':
        if (current?.role === 'assistant' || current?.role === 'tool') current = undefined;
        break;
      // Lifecycle, bookkeeping, and UI-only content never reach the model.
      case 'turn-end':
      case 'run-end':
      case 'run-aborted':
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
        if (action.type.startsWith('data-')) break;
        throw new Error(`toModelMessages: unhandled action ${(action as { type: string }).type}`);
    }
  }
  return messages;
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
