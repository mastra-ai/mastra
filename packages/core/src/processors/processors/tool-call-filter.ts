import type { MastraDBMessage, MessageList } from '../../agent/message-list';
import type { RequestContext } from '../../request-context';

import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../index';

type ToolLikePart = {
  type: string;
  toolCallId?: string;
  toolName?: string;
  toolInvocation?: {
    toolName?: string;
    toolCallId?: string;
  };
};

type MessagePart = MastraDBMessage['content']['parts'][number];

export type ToolCallFilterOptions = {
  /**
   * List of specific tool names to exclude. If not provided, all tool calls are excluded.
   */
  exclude?: string[];
  /**
   * Keep tool calls and results from the latest completed agentic step when processInputStep runs.
   * This lets the model consume the current tool result once before older tool context is pruned.
   *
   * @default true
   */
  preserveLatestStep?: boolean;
};

/**
 * Filters out tool calls and results from messages.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 */
export class ToolCallFilter implements Processor {
  readonly id = 'tool-call-filter';
  name = 'ToolCallFilter';
  private exclude: string[] | 'all';
  private preserveLatestStep: boolean;

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   * @param options.preserveLatestStep Keep the latest step's tool calls and results during processInputStep.
   */
  constructor(options: ToolCallFilterOptions = {}) {
    this.preserveLatestStep = options.preserveLatestStep ?? true;

    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }
  }

  private isToolPart(part: MessagePart): part is MessagePart & ToolLikePart {
    const type = (part as { type?: string }).type;
    return (
      type === 'tool-invocation' ||
      type === 'tool-call' ||
      type === 'tool-result' ||
      type === 'dynamic-tool' ||
      type?.startsWith('tool-') === true
    );
  }

  private getToolCallId(part: ToolLikePart): string | undefined {
    return part.type === 'tool-invocation' ? part.toolInvocation?.toolCallId : part.toolCallId;
  }

  private getToolName(part: ToolLikePart): string | undefined {
    if (part.type === 'tool-invocation') {
      return part.toolInvocation?.toolName;
    }

    if (part.toolName) {
      return part.toolName;
    }

    if (part.type.startsWith('tool-')) {
      const toolName = part.type.slice('tool-'.length);
      return ['call', 'result', 'invocation', 'error', 'delta'].includes(toolName) ? undefined : toolName;
    }

    return undefined;
  }

  private getToolParts(message: MastraDBMessage): Array<MessagePart & ToolLikePart> {
    if (!message.content?.parts) return [];
    return message.content.parts.filter((part): part is MessagePart & ToolLikePart => this.isToolPart(part));
  }

  private collectToolCallIds(parts: MessagePart[], toolCallIds: Set<string>) {
    for (const part of parts) {
      if (!this.isToolPart(part)) continue;
      const toolCallId = this.getToolCallId(part);
      if (toolCallId) {
        toolCallIds.add(toolCallId);
      }
    }
  }

  private getLatestStepToolCallIds(steps: ProcessInputStepArgs['steps'], messages: MastraDBMessage[]): Set<string> {
    if (!this.preserveLatestStep) {
      return new Set();
    }

    const toolCallIds = new Set<string>();
    const latestStep = steps.at(-1);

    const collect = (items: unknown) => {
      if (!Array.isArray(items)) return;

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const toolCallId = (item as { toolCallId?: unknown }).toolCallId;
        if (typeof toolCallId === 'string') {
          toolCallIds.add(toolCallId);
        }
      }
    };

    if (latestStep) {
      collect((latestStep as { toolCalls?: unknown }).toolCalls);
      collect((latestStep as { toolResults?: unknown }).toolResults);
      collect((latestStep as { content?: unknown }).content);
    }

    const parts = messages.flatMap(message => message.content?.parts ?? []);
    const stepStartIndexes = parts.flatMap((part, index) => (part.type === 'step-start' ? [index] : []));
    if (stepStartIndexes.length > 0) {
      const lastStepStartIndex = stepStartIndexes.at(-1)!;
      const partsAfterLastStepStart = parts.slice(lastStepStartIndex + 1);
      const latestStepParts = partsAfterLastStepStart.some(part => this.isToolPart(part))
        ? partsAfterLastStepStart
        : parts.slice((stepStartIndexes.at(-2) ?? -1) + 1);
      this.collectToolCallIds(latestStepParts, toolCallIds);
    }

    return toolCallIds;
  }

  private removeOrphanStepStarts(parts: MessagePart[]): MessagePart[] {
    const filteredParts: MessagePart[] = [];

    for (const part of parts) {
      if (part.type === 'step-start' && (filteredParts.length === 0 || filteredParts.at(-1)?.type === 'step-start')) {
        continue;
      }
      filteredParts.push(part);
    }

    while (filteredParts.at(-1)?.type === 'step-start') {
      filteredParts.pop();
    }

    return filteredParts;
  }

  private shouldKeepTool(
    toolName: unknown,
    toolCallId: unknown,
    preservedToolCallIds: Set<string>,
    excludedToolCallIds: Set<string>,
  ) {
    if (typeof toolCallId === 'string' && preservedToolCallIds.has(toolCallId)) {
      return true;
    }

    if (this.exclude === 'all') {
      return false;
    }

    return !(
      (typeof toolName === 'string' && this.exclude.includes(toolName)) ||
      (typeof toolCallId === 'string' && excludedToolCallIds.has(toolCallId))
    );
  }

  private filterMessages(
    messages: MastraDBMessage[],
    preservedToolCallIds: Set<string> = new Set(),
  ): MastraDBMessage[] {
    if (this.exclude !== 'all' && this.exclude.length === 0) {
      return messages;
    }

    const excludedToolCallIds = new Set<string>();

    if (this.exclude !== 'all') {
      for (const message of messages) {
        for (const part of this.getToolParts(message)) {
          const toolName = this.getToolName(part);
          const toolCallId = this.getToolCallId(part);
          if (toolName && toolCallId && this.exclude.includes(toolName)) {
            excludedToolCallIds.add(toolCallId);
          }
        }

        const toolInvocations = (message.content as { toolInvocations?: unknown }).toolInvocations;
        if (!Array.isArray(toolInvocations)) continue;

        for (const invocation of toolInvocations) {
          if (!invocation || typeof invocation !== 'object') continue;
          const toolName = (invocation as { toolName?: unknown }).toolName;
          const toolCallId = (invocation as { toolCallId?: unknown }).toolCallId;
          if (typeof toolName === 'string' && typeof toolCallId === 'string' && this.exclude.includes(toolName)) {
            excludedToolCallIds.add(toolCallId);
          }
        }
      }
    }

    return messages
      .map(message => {
        const originalParts = message.content?.parts;
        const originalToolInvocations = (message.content as { toolInvocations?: unknown }).toolInvocations;
        const hasToolParts = originalParts?.some(part => this.isToolPart(part)) ?? false;
        const hasToolInvocations = Array.isArray(originalToolInvocations);

        if (!hasToolParts && !hasToolInvocations) {
          return message;
        }

        const filteredParts = originalParts
          ? this.removeOrphanStepStarts(
              originalParts.filter(part => {
                if (!this.isToolPart(part)) {
                  return true;
                }

                return this.shouldKeepTool(
                  this.getToolName(part),
                  this.getToolCallId(part),
                  preservedToolCallIds,
                  excludedToolCallIds,
                );
              }),
            )
          : undefined;

        const filteredToolInvocations = hasToolInvocations
          ? originalToolInvocations.filter(invocation => {
              if (!invocation || typeof invocation !== 'object') {
                return true;
              }

              return this.shouldKeepTool(
                (invocation as { toolName?: unknown }).toolName,
                (invocation as { toolCallId?: unknown }).toolCallId,
                preservedToolCallIds,
                excludedToolCallIds,
              );
            })
          : undefined;

        const meaningfulParts = filteredParts?.filter(part => part.type !== 'step-start') ?? [];
        const hasTextContent =
          typeof message.content?.content === 'string' && message.content.content.trim().length > 0;
        if (meaningfulParts.length === 0 && (filteredToolInvocations?.length ?? 0) === 0 && !hasTextContent) {
          return null;
        }

        const { toolInvocations: _originalToolInvocations, ...contentWithoutToolInvocations } = message.content as any;
        const updatedContent: any = {
          ...contentWithoutToolInvocations,
        };

        if (filteredParts) {
          updatedContent.parts = filteredParts;
        }

        if (filteredToolInvocations && filteredToolInvocations.length > 0) {
          updatedContent.toolInvocations = filteredToolInvocations;
        }

        return {
          ...message,
          content: updatedContent,
        };
      })
      .filter((message): message is MastraDBMessage => message !== null);
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    requestContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messageList } = args;
    // Use messages from messageList to respect consolidation
    const messages = messageList.get.all.db();
    return this.filterMessages(messages);
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult> {
    const preservedToolCallIds = this.getLatestStepToolCallIds(args.steps, args.messages);
    return {
      modelContextMessages: this.filterMessages(args.messages, preservedToolCallIds),
    };
  }
}
