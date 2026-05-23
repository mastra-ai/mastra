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
        return [
          {
            ...event,
            type: 'ask_question',
            questionId: itemId,
            question: payload.question ?? 'The agent needs your input.',
            options: payload.options,
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
        return [event as unknown as LegacyHarnessEvent];
      default:
        return [event as unknown as LegacyHarnessEvent];
    }
  }
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
