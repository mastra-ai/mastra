import type { MastraProviderMetadata } from '../agent/message-list/state/types';
import type { CreatedAgentSignal } from '../agent/signals';
import type { ActionBase, PersistableAction } from './types';

type BaseField = 'id' | 'threadId' | 'resourceId' | 'runId' | 'traceId' | 'createdAt';

/** An action without engine-stamped fields. The run engine adds ids, thread/run ids and timestamps. */
export type ActionDraft = PersistableAction extends infer A
  ? A extends ActionBase
    ? Omit<A, BaseField>
    : never
  : never;

export type ToActionsResult = {
  /** System messages found in the input. Used as extra instructions, never persisted as content. */
  system: string[];
  actions: ActionDraft[];
};

/**
 * Supported input shapes:
 * - string
 * - AI SDK v4 CoreMessage (tool-call `args`, tool-result `result`)
 * - AI SDK v5/v6/v7 ModelMessage (tool-call `input`, tool-result `output`)
 * - AI SDK v4 UIMessage (`toolInvocations`) and v5/v6/v7 UIMessage (`parts`)
 * - signals from `createSignal` (non-state, non-transient)
 *
 * Inputs come from callers, so parts are read structurally rather than trusted to match one SDK version.
 */
export type AgentInput = string | AnyMessage | CreatedAgentSignal | Array<string | AnyMessage | CreatedAgentSignal>;

type AnyMessage = { role: string; content?: unknown; parts?: unknown[]; toolInvocations?: unknown[] };
type AnyPart = { type: string; [key: string]: unknown };

export function toActions(input: AgentInput): ToActionsResult {
  const { system, messages } = toActionsByMessage(input);
  return { system, actions: messages.flatMap(m => m.actions) };
}

export type InputMessageActions = {
  /** `user` for strings and signals. */
  role: 'user' | 'assistant' | 'tool' | 'system';
  actions: ActionDraft[];
};

/** `toActions`, keeping which input message each action came from. */
export function toActionsByMessage(input: AgentInput): { system: string[]; messages: InputMessageActions[] } {
  const system: string[] = [];
  const messages: InputMessageActions[] = [];
  const list = typeof input === 'string' ? [input] : Array.isArray(input) ? input : [input];
  for (const message of list) {
    if (typeof message === 'string') {
      messages.push({ role: 'user', actions: [{ type: 'text', role: 'user', text: message }] });
      continue;
    }
    if ('__isCreatedSignal' in message) {
      messages.push({ role: 'user', actions: [signalToAction(message)] });
      continue;
    }
    const result: ToActionsResult = { system, actions: [] };
    convertMessage(message, result);
    messages.push({ role: message.role as InputMessageActions['role'], actions: result.actions });
  }
  linkApprovals(messages.flatMap(m => m.actions));
  return { system, messages };
}

function signalToAction(signal: CreatedAgentSignal): ActionDraft {
  if (signal.type === 'state') throw new Error('State signals are not supported on action-native runs yet');
  if (signal.transient) throw new Error('Transient signals are not supported on action-native runs yet');
  const contents =
    typeof signal.contents === 'string'
      ? [{ type: 'text' as const, text: signal.contents }]
      : signal.contents.map(part =>
          part.type === 'text'
            ? { type: 'text' as const, text: part.text }
            : {
                type: 'file' as const,
                data: dataToString(part.data),
                mediaType: part.mediaType,
                ...(part.filename ? { filename: part.filename } : {}),
              },
        );
  return {
    type: 'signal',
    category: signal.type,
    contents,
    ...(signal.tagName ? { tagName: signal.tagName } : {}),
    ...(signal.attributes ? { attributes: signal.attributes } : {}),
    ...(signal.metadata ? { metadata: signal.metadata } : {}),
  };
}

/** v7 approval parts carry only `approvalId` (and the request only `toolCallId`); fill refs from earlier actions. */
function linkApprovals(actions: ActionDraft[]) {
  const toolNames = new Map<string, string>();
  const approvalCalls = new Map<string, string>();
  for (const action of actions) {
    if (action.type === 'tool-call') toolNames.set(action.toolCallId, action.toolName);
    if (action.type === 'tool-approval-requested') {
      action.toolName ||= toolNames.get(action.toolCallId) ?? '';
      approvalCalls.set(action.approvalId, action.toolCallId);
    }
    if (action.type === 'tool-approval-responded') {
      action.toolCallId ||= approvalCalls.get(action.approvalId) ?? '';
      action.toolName ||= toolNames.get(action.toolCallId) ?? '';
    }
  }
}

function convertMessage(message: AnyMessage, out: ToActionsResult) {
  const role = message.role;
  if (role === 'system') {
    out.system.push(typeof message.content === 'string' ? message.content : partsText(message.content));
    return;
  }
  if (role !== 'user' && role !== 'assistant' && role !== 'tool') {
    throw new Error(`Unsupported message role: ${role}`);
  }

  // UIMessage (v5+): parts are authoritative.
  if (Array.isArray(message.parts) && message.parts.length > 0) {
    for (const part of message.parts as AnyPart[]) convertUIPart(part, role, out);
    return;
  }

  // v4 UIMessage tool invocations.
  if (Array.isArray(message.toolInvocations)) {
    if (typeof message.content === 'string' && message.content) {
      out.actions.push({ type: 'text', role: asContentRole(role), text: message.content });
    }
    for (const inv of message.toolInvocations as AnyPart[]) convertV4ToolInvocation(inv, out);
    return;
  }

  const content = message.content;
  if (typeof content === 'string') {
    if (content) out.actions.push({ type: 'text', role: asContentRole(role), text: content });
    return;
  }
  if (!Array.isArray(content)) throw new Error(`Unsupported message content for role ${role}`);
  for (const part of content as AnyPart[]) convertModelPart(part, role, out);
}

function asContentRole(role: string): 'user' | 'assistant' {
  return role === 'user' ? 'user' : 'assistant';
}

function convertModelPart(part: AnyPart, role: string, out: ToActionsResult) {
  const providerMetadata = meta(part.providerOptions ?? part.providerMetadata);
  const contentRole = asContentRole(role);
  switch (part.type) {
    case 'text':
      out.actions.push({ type: 'text', role: contentRole, text: String(part.text), ...providerMetadata });
      return;
    case 'image':
      out.actions.push({
        type: 'file',
        role: contentRole,
        mediaType: (part.mediaType as string) ?? (part.mimeType as string) ?? 'image/*',
        data: dataToString(part.image),
        ...providerMetadata,
      });
      return;
    case 'file':
      out.actions.push({
        type: 'file',
        role: contentRole,
        mediaType: (part.mediaType as string) ?? (part.mimeType as string),
        data: dataToString(part.data),
        ...(part.filename ? { filename: part.filename as string } : {}),
        ...providerMetadata,
      });
      return;
    case 'reasoning':
      out.actions.push({ type: 'reasoning', role: 'assistant', text: String(part.text), ...providerMetadata });
      return;
    case 'redacted-reasoning':
      out.actions.push({
        type: 'reasoning',
        role: 'assistant',
        text: '',
        providerMetadata: { ...(providerMetadata.providerMetadata ?? {}), redacted: { data: part.data } },
      } as ActionDraft);
      return;
    case 'reasoning-file':
      out.actions.push({
        type: 'reasoning-file',
        role: 'assistant',
        mediaType: part.mediaType as string,
        data: dataToString(part.data),
        ...providerMetadata,
      });
      return;
    case 'tool-call':
      out.actions.push({
        type: 'tool-call',
        role: 'assistant',
        toolCallId: part.toolCallId as string,
        toolName: part.toolName as string,
        input: 'input' in part ? part.input : part.args,
        ...(part.providerExecuted ? { providerExecuted: true } : {}),
        ...providerMetadata,
      });
      return;
    case 'tool-result':
      out.actions.push(toolResultAction(part, providerMetadata));
      return;
    case 'tool-approval-request':
      out.actions.push({
        type: 'tool-approval-requested',
        approvalId: part.approvalId as string,
        toolCallId: part.toolCallId as string,
        toolName: (part.toolName as string) ?? '',
      });
      return;
    case 'tool-approval-response':
      out.actions.push({
        type: 'tool-approval-responded',
        approvalId: part.approvalId as string,
        approved: Boolean(part.approved),
        toolCallId: (part.toolCallId as string) ?? '',
        toolName: (part.toolName as string) ?? '',
        ...(part.reason ? { reason: part.reason as string } : {}),
      });
      return;
    case 'custom':
      out.actions.push({ type: 'provider-event', kind: part.kind as `${string}.${string}`, ...providerMetadata });
      return;
    default:
      throw new Error(`Unsupported model message part: ${part.type}`);
  }
}

function toolResultAction(part: AnyPart, providerMetadata: { providerMetadata?: MastraProviderMetadata }): ActionDraft {
  const ref = { toolCallId: part.toolCallId as string, toolName: part.toolName as string };
  // v4: { result, isError? }
  if (!('output' in part)) {
    if (part.isError) return { type: 'tool-error', ...ref, errorText: stringify(part.result), ...providerMetadata };
    return { type: 'tool-result', ...ref, output: part.result, ...providerMetadata };
  }
  const output = part.output as AnyPart & { value?: unknown; reason?: string };
  switch (output.type) {
    case 'text':
    case 'json':
      return { type: 'tool-result', ...ref, output: output.value, ...providerMetadata };
    case 'content':
      return { type: 'tool-result', ...ref, output: output.value, modelOutput: output, ...providerMetadata };
    case 'error-text':
    case 'error-json':
      return { type: 'tool-error', ...ref, errorText: stringify(output.value), ...providerMetadata };
    case 'execution-denied':
      return { type: 'tool-denied', ...ref, ...(output.reason ? { reason: output.reason } : {}), ...providerMetadata };
    default:
      throw new Error(`Unsupported tool-result output: ${output.type}`);
  }
}

function convertUIPart(part: AnyPart, role: string, out: ToActionsResult) {
  const providerMetadata = meta(part.providerMetadata);
  const contentRole = asContentRole(role);
  if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
    convertUIToolPart(part, out);
    return;
  }
  if (part.type.startsWith('data-')) {
    out.actions.push({ type: part.type as `data-${string}`, role: contentRole, data: part.data });
    return;
  }
  switch (part.type) {
    case 'text':
      out.actions.push({ type: 'text', role: contentRole, text: String(part.text), ...providerMetadata });
      return;
    case 'reasoning':
      out.actions.push({ type: 'reasoning', role: 'assistant', text: String(part.text), ...providerMetadata });
      return;
    case 'file':
      out.actions.push({
        type: 'file',
        role: contentRole,
        mediaType: part.mediaType as string,
        data: part.url as string,
        ...(part.filename ? { filename: part.filename as string } : {}),
        ...providerMetadata,
      });
      return;
    case 'reasoning-file':
      out.actions.push({
        type: 'reasoning-file',
        role: 'assistant',
        mediaType: part.mediaType as string,
        data: part.url as string,
        ...providerMetadata,
      });
      return;
    case 'source-url':
      out.actions.push({
        type: 'source-url',
        role: 'assistant',
        sourceId: part.sourceId as string,
        url: part.url as string,
        ...(part.title ? { title: part.title as string } : {}),
        ...providerMetadata,
      } as ActionDraft);
      return;
    case 'source-document':
      out.actions.push({
        type: 'source-document',
        role: 'assistant',
        sourceId: part.sourceId as string,
        mediaType: part.mediaType as string,
        title: part.title as string,
        ...(part.filename ? { filename: part.filename as string } : {}),
        ...providerMetadata,
      });
      return;
    case 'custom':
      out.actions.push({ type: 'provider-event', kind: part.kind as `${string}.${string}`, ...providerMetadata });
      return;
    case 'step-start':
      // Turn boundaries are recorded by the engine, not reconstructed from UI history.
      return;
    default:
      throw new Error(`Unsupported UI message part: ${part.type}`);
  }
}

function convertUIToolPart(part: AnyPart, out: ToActionsResult) {
  const toolName = part.type === 'dynamic-tool' ? (part.toolName as string) : part.type.slice('tool-'.length);
  const ref = { toolCallId: part.toolCallId as string, toolName };
  const state = part.state as string;
  if (state === 'input-streaming') return;
  out.actions.push({
    type: 'tool-call',
    role: 'assistant',
    ...ref,
    input: part.input,
    ...(part.providerExecuted ? { providerExecuted: true } : {}),
    ...(part.title ? { title: part.title as string } : {}),
    ...meta(part.callProviderMetadata),
  });

  const approval = part.approval as { id: string; approved?: boolean; reason?: string } | undefined;
  if (approval) {
    out.actions.push({ type: 'tool-approval-requested', ...ref, approvalId: approval.id });
    if (approval.approved !== undefined) {
      out.actions.push({
        type: 'tool-approval-responded',
        ...ref,
        approvalId: approval.id,
        approved: approval.approved,
        ...(approval.reason ? { reason: approval.reason } : {}),
      });
    }
  }

  const resultMeta = meta(part.resultProviderMetadata);
  switch (state) {
    case 'input-available':
    case 'approval-requested':
    case 'approval-responded':
      return;
    case 'output-available':
      out.actions.push({ type: 'tool-result', ...ref, output: part.output, ...resultMeta });
      return;
    case 'output-error':
      out.actions.push({ type: 'tool-error', ...ref, errorText: String(part.errorText), ...resultMeta });
      return;
    case 'output-denied':
      out.actions.push({ type: 'tool-denied', ...ref, ...(approval?.reason ? { reason: approval.reason } : {}) });
      return;
    default:
      throw new Error(`Unsupported tool UI part state: ${state}`);
  }
}

function convertV4ToolInvocation(inv: AnyPart, out: ToActionsResult) {
  const ref = { toolCallId: inv.toolCallId as string, toolName: inv.toolName as string };
  if (inv.state === 'partial-call') return;
  out.actions.push({ type: 'tool-call', role: 'assistant', ...ref, input: inv.args });
  if (inv.state === 'result') out.actions.push({ type: 'tool-result', ...ref, output: inv.result });
}

function meta(value: unknown): { providerMetadata?: MastraProviderMetadata } {
  return value && typeof value === 'object' ? { providerMetadata: value as MastraProviderMetadata } : {};
}

function partsText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return (content as AnyPart[])
    .filter(p => p.type === 'text')
    .map(p => String(p.text))
    .join('');
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/** Normalizes AI SDK DataContent / URL / FileData into the string form stored on file actions. */
function dataToString(data: unknown): string {
  if (typeof data === 'string') return data;
  if (data instanceof URL) return data.href;
  if (data instanceof Uint8Array) return Buffer.from(data).toString('base64');
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString('base64');
  if (data && typeof data === 'object' && 'type' in data) {
    const fd = data as { type: string; data?: unknown; url?: unknown; text?: string };
    if (fd.type === 'data') return dataToString(fd.data);
    if (fd.type === 'url') return dataToString(fd.url);
    if (fd.type === 'text') return Buffer.from(fd.text ?? '').toString('base64');
  }
  throw new Error('Unsupported file data');
}
