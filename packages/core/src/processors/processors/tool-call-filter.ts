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
 * Runs on both initial input (processInput) and each agentic loop step
 * (processInputStep), so tool calls from previous steps are filtered
 * before the next LLM call.
 */
export class ToolCallFilter implements Processor {
  readonly id = 'tool-call-filter';
  name = 'ToolCallFilter';
  private exclude: string[] | 'all';

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  constructor(options: { exclude?: string[] } = {}) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
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
    const { messageList, stepNumber } = args;
    if (stepNumber === 0) return {};

    const messages = messageList.get.all.db();

    // Collect step-start positions (message index + part index) so we can
    // distinguish tool calls from the most recent step vs older steps.
    // In the real agent loop all tool-invocation parts live in the same
    // assistant message separated by step-start parts.
    const stepStarts = this.collectStepStartPositions(messages);

    if (stepStarts.length === 0) {
      // No step boundaries (e.g. messages loaded from memory without
      // step-start markers). Filter all tool calls.
      return { messages: this.filterMessages(messages) };
    }

    if (stepStarts.length < 2) {
      // Only 1 step-start → only 1 previous step whose tool results the
      // LLM still needs to formulate its response. Don't filter.
      return {};
    }

    // 2+ step-starts: filter tool calls from parts before the
    // second-to-last step-start while preserving the most recent step's
    // tool results.
    const boundary = stepStarts[stepStarts.length - 2]!;
    return { messages: this.filterToolCallsBeforeBoundary(messages, boundary) };
  }

  private collectStepStartPositions(messages: MastraDBMessage[]): Array<{ msgIdx: number; partIdx: number }> {
    const positions: Array<{ msgIdx: number; partIdx: number }> = [];
    for (let m = 0; m < messages.length; m++) {
      const msg = messages[m]!;
      if (typeof msg.content === 'string' || !msg.content?.parts) continue;
      for (let p = 0; p < msg.content.parts.length; p++) {
        if ((msg.content.parts[p] as any).type === 'step-start') {
          positions.push({ msgIdx: m, partIdx: p });
        }
      }
    }
    return positions;
  }

  /**
   * Filter tool-invocation parts that appear before the given boundary
   * position while keeping parts at or after the boundary intact.
   */
  private filterToolCallsBeforeBoundary(
    messages: MastraDBMessage[],
    boundary: { msgIdx: number; partIdx: number },
  ): MastraDBMessage[] {
    return messages
      .map((msg, msgIdx) => {
        if (typeof msg.content === 'string' || !msg.content?.parts) return msg;
        if (!this.hasToolInvocations(msg)) return msg;

        // Message entirely after boundary — keep as-is
        if (msgIdx > boundary.msgIdx) return msg;

        // Message entirely before boundary — filter using existing logic
        if (msgIdx < boundary.msgIdx) {
          const filtered = this.filterMessages([msg]);
          return filtered.length > 0 ? filtered[0]! : null;
        }

        // Message contains the boundary — filter parts before it only
        const filteredParts = msg.content.parts.filter((part: any, partIdx: number) => {
          if (partIdx >= boundary.partIdx) return true;
          if (part.type !== 'tool-invocation') return true;

          if (this.exclude === 'all') return false;
          if (Array.isArray(this.exclude)) {
            const invocation = (part as unknown as V2ToolInvocationPart).toolInvocation;
            return !this.exclude.includes(invocation.toolName);
          }
          return true;
        });

        if (filteredParts.length === 0) return null;

        const { toolInvocations: _ti, ...contentWithoutToolInvocations } = msg.content as any;
        return {
          ...msg,
          content: { ...contentWithoutToolInvocations, parts: filteredParts },
        };
      })
      .filter((m): m is MastraDBMessage => m !== null);
  }

  private filterMessages(messages: MastraDBMessage[]): MastraDBMessage[] {
    if (this.exclude === 'all') {
      return this.filterAllToolCalls(messages);
    }

    if (this.exclude.length > 0) {
      return this.filterSpecificToolCalls(messages);
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

  private filterAllToolCalls(messages: MastraDBMessage[]): MastraDBMessage[] {
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

        const nonToolParts = message.content.parts.filter((part: any) => part.type !== 'tool-invocation');

        if (nonToolParts.length === 0) {
          return null;
        }

        const { toolInvocations: originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
        const updatedContent: any = {
          ...contentWithoutToolInvocations,
          parts: nonToolParts,
        };

        return {
          ...message,
          content: updatedContent,
        };
      })
      .filter((message): message is MastraDBMessage => message !== null);
  }

  private filterSpecificToolCalls(messages: MastraDBMessage[]): MastraDBMessage[] {
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

        if ('toolInvocations' in message.content && Array.isArray((message.content as any).toolInvocations)) {
          const filteredToolInvocations = (message.content as any).toolInvocations.filter(
            (inv: any) => !this.exclude.includes(inv.toolName),
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
