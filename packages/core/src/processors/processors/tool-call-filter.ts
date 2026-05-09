import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import type { RequestContext } from '../../request-context';

import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../index';

/**
 * Type definition for tool invocation parts in MastraDBMessage format 2
 */
type V2ToolInvocationPart = {
  type: 'tool-invocation';
  toolInvocation: {
    toolName: string;
    toolCallId: string;
    args: unknown;
    result?: unknown;
    state: 'call' | 'result';
  };
};

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 *
 * Runs on initial input (processInput). Step filtering is opt-in via filterAfterToolSteps.
 */
export class ToolCallFilter implements Processor {
  readonly id = 'tool-call-filter';
  name = 'ToolCallFilter';
  private exclude: string[] | 'all';
  private filterAfterToolSteps: number | undefined;

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   * @param options.filterAfterToolSteps Enable agentic loop step filtering and preserve tool calls/results from this many recent tool-producing steps.
   */
  constructor(options: { exclude?: string[]; filterAfterToolSteps?: number } = {}) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }

    this.filterAfterToolSteps = options.filterAfterToolSteps;
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messageList } = args;
    const messages = messageList.get.all.db();
    return this.filterMessages(messages);
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    if (this.filterAfterToolSteps === undefined) {
      return {};
    }

    const { messageList } = args;
    const messages = messageList.get.all.db();
    return { messages: this.filterMessages(messages, this.getRecentToolStepToolCallIds(args)) };
  }

  private getRecentToolStepToolCallIds(args: ProcessInputStepArgs): Set<string> {
    const state = args.state as {
      toolCallFilterSeenToolCallIds?: string[];
      toolCallFilterStepToolCallIds?: string[][];
    };
    const seenToolCallIds = new Set(state.toolCallFilterSeenToolCallIds ?? []);
    const responseToolCallIds = this.getMessageToolCallIds(args.messageList.get.response.db());
    const newToolCallIds = [...responseToolCallIds].filter(toolCallId => !seenToolCallIds.has(toolCallId));

    state.toolCallFilterSeenToolCallIds = [...new Set([...seenToolCallIds, ...newToolCallIds])];
    state.toolCallFilterStepToolCallIds = [...(state.toolCallFilterStepToolCallIds ?? []), newToolCallIds];

    const preserveStepCount = Math.max(0, this.filterAfterToolSteps ?? 0);
    const recentStepToolCallIds =
      preserveStepCount === 0 ? [] : state.toolCallFilterStepToolCallIds.slice(-preserveStepCount).flat();

    return new Set(recentStepToolCallIds);
  }

  private getMessageToolCallIds(messages: MastraDBMessage[]): Set<string> {
    const toolCallIds = new Set<string>();

    for (const message of messages) {
      for (const part of this.getToolInvocations(message)) {
        const invocationPart = part as unknown as V2ToolInvocationPart;
        const toolCallId =
          invocationPart.toolInvocation.toolCallId ?? (invocationPart.toolInvocation as any).toolCall?.id;
        if (toolCallId) {
          toolCallIds.add(toolCallId);
        }
      }
    }

    return toolCallIds;
  }

  private filterMessages(messages: MastraDBMessage[], preserveToolCallIds = new Set<string>()): MastraDBMessage[] {
    if (this.exclude === 'all') {
      return this.filterAllToolCalls(messages, preserveToolCallIds);
    }

    if (this.exclude.length > 0) {
      return this.filterSpecificToolCalls(messages, preserveToolCallIds);
    }

    return messages;
  }

  private hasToolInvocations(message: MastraDBMessage): boolean {
    if (typeof message.content === 'string') return false;
    if (!message.content?.parts) return false;
    return message.content.parts.some(part => part.type === 'tool-invocation');
  }

  private getToolInvocations(message: MastraDBMessage) {
    if (typeof message.content === 'string') return [];
    if (!message.content?.parts) return [];
    return message.content.parts.filter((part: any) => part.type === 'tool-invocation');
  }

  private filterAllToolCalls(messages: MastraDBMessage[], preserveToolCallIds = new Set<string>()): MastraDBMessage[] {
    return messages
      .map(message => {
        if (!this.hasToolInvocations(message)) {
          return message;
        }

        if (typeof message.content === 'string') {
          return message;
        }

        if (!message.content?.parts) {
          return message;
        }

        const nonToolParts = message.content.parts.filter((part: any) => {
          if (part.type !== 'tool-invocation') {
            return true;
          }

          return preserveToolCallIds.has(part.toolInvocation?.toolCallId ?? part.toolInvocation?.toolCall?.id);
        });

        if (nonToolParts.length === 0) {
          return null;
        }

        const { toolInvocations: originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
        const updatedContent: any = {
          ...contentWithoutToolInvocations,
          parts: nonToolParts,
        };

        if (Array.isArray(originalToolInvocations)) {
          const preservedToolInvocations = originalToolInvocations.filter((inv: any) =>
            preserveToolCallIds.has(inv.toolCallId ?? inv.toolCall?.id),
          );
          if (preservedToolInvocations.length > 0) {
            updatedContent.toolInvocations = preservedToolInvocations;
          }
        }

        return {
          ...message,
          content: updatedContent,
        };
      })
      .filter((message): message is MastraDBMessage => message !== null);
  }

  private filterSpecificToolCalls(
    messages: MastraDBMessage[],
    preserveToolCallIds = new Set<string>(),
  ): MastraDBMessage[] {
    const excludedToolCallIds = new Set<string>();

    for (const message of messages) {
      const toolInvocations = this.getToolInvocations(message);
      for (const part of toolInvocations) {
        const invocationPart = part as unknown as V2ToolInvocationPart;
        const invocation = invocationPart.toolInvocation;

        if (this.exclude.includes(invocation.toolName)) {
          excludedToolCallIds.add(invocation.toolCallId);
        }
      }
    }

    return messages
      .map(message => {
        if (!this.hasToolInvocations(message)) {
          return message;
        }

        if (typeof message.content === 'string') {
          return message;
        }

        if (!message.content?.parts) {
          return message;
        }

        const filteredParts = message.content.parts.filter((part: any) => {
          if (part.type !== 'tool-invocation') {
            return true;
          }

          const invocationPart = part as unknown as V2ToolInvocationPart;
          const invocation = invocationPart.toolInvocation;

          if (preserveToolCallIds.has(invocation.toolCallId ?? (invocation as any).toolCall?.id)) {
            return true;
          }

          if (invocation.state === 'call' && this.exclude.includes(invocation.toolName)) {
            return false;
          }

          if (invocation.state === 'result' && excludedToolCallIds.has(invocation.toolCallId)) {
            return false;
          }

          if (invocation.state === 'result' && this.exclude.includes(invocation.toolName)) {
            return false;
          }

          return true;
        });

        if (filteredParts.length === 0) {
          return null;
        }

        const { toolInvocations: originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
        const updatedContent: any = {
          ...contentWithoutToolInvocations,
          parts: filteredParts,
        };

        if (Array.isArray(originalToolInvocations)) {
          const filteredToolInvocations = originalToolInvocations.filter(
            (inv: any) =>
              preserveToolCallIds.has(inv.toolCallId ?? inv.toolCall?.id) || !this.exclude.includes(inv.toolName),
          );
          if (filteredToolInvocations.length > 0) {
            updatedContent.toolInvocations = filteredToolInvocations;
          }
        }

        const hasNoToolParts = filteredParts.length === 0;
        const hasNoTextContent = !updatedContent.content || updatedContent.content.trim() === '';

        if (hasNoToolParts && hasNoTextContent) {
          return null;
        }

        return {
          ...message,
          content: updatedContent,
        };
      })
      .filter((message): message is MastraDBMessage => message !== null);
  }
}
