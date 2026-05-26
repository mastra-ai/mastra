import type { HarnessEvent as LegacyHarnessEvent, HarnessMessage, HarnessThread } from '@mastra/core/harness';
import type { HarnessEvent as HarnessV1Event, SessionDisplayState } from '@mastra/core/harness/v1';

type EmitLegacyEvent = (event: LegacyHarnessEvent) => void;

function textMessage(messageId: string, text: string): HarnessMessage {
  return {
    id: messageId,
    role: 'assistant',
    content: [{ type: 'text', text }],
    createdAt: new Date(),
  };
}

export class MastraCodeHarnessEventProjector {
  private readonly assistantText = new Map<string, string>();
  private readonly toolNames = new Map<string, string>();

  constructor(
    private readonly emitLegacy: EmitLegacyEvent,
    private readonly getDisplayState: () => SessionDisplayState | Record<string, unknown>,
    private readonly getThread: (threadId: string, resourceId: string) => Promise<HarnessThread | undefined>,
  ) {}

  async project(event: HarnessV1Event): Promise<void> {
    const projected = await this.toLegacyEvents(event);
    for (const legacy of projected) {
      this.emitLegacy(legacy);
      this.emitLegacy({
        type: 'display_state_changed',
        displayState: this.getDisplayState(),
      } as unknown as LegacyHarnessEvent);
    }
  }

  private async toLegacyEvents(event: HarnessV1Event): Promise<LegacyHarnessEvent[]> {
    switch (event.type) {
      case 'message_start': {
        this.assistantText.set(event.messageId, '');
        return [{ ...event, message: textMessage(event.messageId, '') } as unknown as LegacyHarnessEvent];
      }
      case 'message_update': {
        const next = `${this.assistantText.get(event.messageId) ?? ''}${event.delta}`;
        this.assistantText.set(event.messageId, next);
        return [{ ...event, message: textMessage(event.messageId, next) } as unknown as LegacyHarnessEvent];
      }
      case 'message_end': {
        const text = this.assistantText.get(event.messageId) ?? '';
        this.assistantText.delete(event.messageId);
        return [{ ...event, message: textMessage(event.messageId, text) } as unknown as LegacyHarnessEvent];
      }
      case 'thread_created': {
        const thread = await this.getThread(event.threadId, event.resourceId);
        return [
          {
            ...event,
            thread: thread ?? {
              id: event.threadId,
              resourceId: event.resourceId,
              title: event.title,
              createdAt: new Date(event.timestamp),
              updatedAt: new Date(event.timestamp),
            },
          } as unknown as LegacyHarnessEvent,
        ];
      }
      case 'thread_cloned': {
        const thread = await this.getThread(event.threadId, event.resourceId);
        return [
          {
            ...event,
            thread: thread ?? {
              id: event.threadId,
              resourceId: event.resourceId,
              title: event.title,
              createdAt: new Date(event.timestamp),
              updatedAt: new Date(event.timestamp),
            },
          } as unknown as LegacyHarnessEvent,
        ];
      }
      case 'thread_renamed':
        return [
          {
            ...event,
            threadId: event.threadId,
            resourceId: event.resourceId,
            title: event.title,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'subagent_start':
        return [{ ...event, forked: (event as { forked?: boolean }).forked ?? false } as unknown as LegacyHarnessEvent];
      case 'subagent_text_delta':
        return [{ ...event, textDelta: event.delta } as unknown as LegacyHarnessEvent];
      case 'tool_start':
        this.toolNames.set(event.toolCallId, event.toolName);
        return [event as unknown as LegacyHarnessEvent];
      case 'tool_end':
        this.toolNames.delete(event.toolCallId);
        return [event as unknown as LegacyHarnessEvent];
      case 'subagent_tool_start':
        return [
          {
            ...event,
            subToolCallId: event.innerToolCallId,
            subToolName: event.toolName,
            subToolArgs: (event as { args?: unknown }).args,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'subagent_tool_end':
        return [
          {
            ...event,
            subToolCallId: event.innerToolCallId,
            subToolName: event.toolName,
            subToolResult: event.output,
            result: event.output,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'subagent_end':
        return [{ ...event, result: stringifySubagentOutput(event.output) } as unknown as LegacyHarnessEvent];
      case 'sandbox_access_requested':
        return [projectSandboxAccessRequested(event) as unknown as LegacyHarnessEvent];
      case 'suspension_required':
        return this.projectSuspensionRequired(event);
      case 'suspension_resolved':
        return [event as unknown as LegacyHarnessEvent];
      default:
        return [event as unknown as LegacyHarnessEvent];
    }
  }

  private projectSuspensionRequired(
    event: Extract<HarnessV1Event, { type: 'suspension_required' }>,
  ): LegacyHarnessEvent[] {
    const displayState = this.getDisplayState() as { pending?: any };
    const pending = displayState.pending;
    const itemId = pending?.itemId ?? event.toolCallId;
    const payload = pending?.payload ?? {};

    switch (event.kind) {
      case 'question':
        if (isSandboxAccessQuestion(itemId, payload)) {
          const sandboxRequest = parseSandboxAccessQuestion(payload.question);
          if (sandboxRequest) {
            return [
              {
                ...event,
                type: 'sandbox_access_request',
                questionId: itemId,
                path: sandboxRequest.path,
                reason: sandboxRequest.reason,
              } as unknown as LegacyHarnessEvent,
            ];
          }
        }
        return [
          {
            ...event,
            type: 'ask_question',
            questionId: itemId,
            question: payload.question ?? 'The agent needs your input.',
            options: payload.options,
            // selectionMode reaches the TUI only when projected through this
            // path; drop anything we don't recognize so a malformed payload
            // can't end up as a stringy "mode".
            selectionMode:
              payload.selectionMode === 'single_select' || payload.selectionMode === 'multi_select'
                ? payload.selectionMode
                : undefined,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'plan-approval':
        return [
          {
            ...event,
            type: 'plan_approval_required',
            planId: itemId,
            title: payload.title ?? 'Plan',
            plan: payload.plan ?? '',
          } as unknown as LegacyHarnessEvent,
        ];
      case 'tool-approval':
        return [
          {
            ...event,
            type: 'tool_approval_required',
            toolCallId: event.toolCallId,
            toolName: event.toolName ?? pending?.toolName ?? 'unknown',
            args: payload.input,
            category: payload.toolCategory,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'tool-suspension':
        return [
          {
            ...event,
            type: 'tool_suspended',
            toolCallId: event.toolCallId,
            toolName: event.toolName ?? pending?.toolName ?? 'unknown',
            args: payload.input ?? payload.args,
            suspendPayload: payload.suspendPayload ?? payload,
          } as unknown as LegacyHarnessEvent,
        ];
      case 'sandbox-access':
        return [];
      default:
        return [event as unknown as LegacyHarnessEvent];
    }
  }
}

function projectSandboxAccessRequested(
  event: Extract<HarnessV1Event, { type: 'sandbox_access_requested' }>,
): Record<string, unknown> {
  return {
    ...event,
    type: 'sandbox_access_request',
    questionId: event.requestId,
    path: describeSandboxAccessTarget(event),
    reason: event.reason ?? describeSandboxAccessReason(event.semanticType),
    responseKind: 'sandbox-access',
  };
}

function describeSandboxAccessTarget(event: Extract<HarnessV1Event, { type: 'sandbox_access_requested' }>): string {
  const payload = event.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    if (typeof record.path === 'string') return record.path;
    if (typeof record.command === 'string') return record.command;
    if (typeof record.host === 'string') {
      return typeof record.port === 'number' ? `${record.host}:${record.port}` : record.host;
    }
    if (typeof record.server === 'string') {
      return typeof record.action === 'string' ? `${record.server}:${record.action}` : record.server;
    }
  }
  return event.semanticType;
}

function describeSandboxAccessReason(semanticType: string): string {
  switch (semanticType) {
    case 'file':
      return 'The agent requested filesystem access.';
    case 'command':
      return 'The agent requested command execution access.';
    case 'network':
      return 'The agent requested network access.';
    case 'mcp':
      return 'The agent requested MCP access.';
    default:
      return 'The agent requested sandbox access.';
  }
}

function isSandboxAccessQuestion(itemId: string, payload: { question?: unknown }): boolean {
  return itemId.startsWith('sandbox_') && typeof payload.question === 'string';
}

function parseSandboxAccessQuestion(question: unknown): { path: string; reason: string } | undefined {
  if (typeof question !== 'string') return undefined;
  const prefix = 'Allow Mastra Code to access ';
  const separator = '?\n\n';
  if (!question.startsWith(prefix)) return undefined;
  const separatorIndex = question.lastIndexOf(separator);
  if (separatorIndex <= prefix.length) return undefined;
  return {
    path: question.slice(prefix.length, separatorIndex),
    reason: question.slice(separatorIndex + separator.length),
  };
}

function stringifySubagentOutput(output: unknown): string {
  if (typeof output === 'string') return output;
  if (output instanceof Error) return output.message;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}
