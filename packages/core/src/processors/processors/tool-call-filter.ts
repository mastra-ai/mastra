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
  providerMetadata?: {
    mastra?: Record<string, unknown>;
  };
};

export type ToolCallFilterOptions = {
  exclude?: string[];
  filterAfterToolSteps?: number;
  preserveModelOutput?: boolean;
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
  private preserveModelOutput: boolean;

  /**
   * Create a filter for tool calls and results.
   * @param options Configuration options
   * @param options.exclude List of specific tool names to exclude. If not provided, all tool calls are excluded.
   * @param options.filterAfterToolSteps Enable agentic loop step filtering and preserve tool calls/results from this many recent tool-producing steps.
   * @param options.preserveModelOutput Preserve sanitized model-facing output from completed filtered tool results with providerMetadata.mastra.modelOutput.
   */
  constructor(options: ToolCallFilterOptions = {}) {
    // If no options or exclude is provided, exclude all tools
    if (!options || !options.exclude) {
      this.exclude = 'all'; // Exclude all tools
    } else {
      // Exclude specific tools
      this.exclude = Array.isArray(options.exclude) ? options.exclude : [];
    }

    this.filterAfterToolSteps = options.filterAfterToolSteps;
    this.preserveModelOutput = options.preserveModelOutput ?? false;
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

  private getToolCallId(invocation: V2ToolInvocationPart['toolInvocation']): string | undefined {
    return invocation.toolCallId ?? (invocation as any).toolCall?.id;
  }

  private getPreservedModelOutputPart(part: V2ToolInvocationPart): { type: 'text'; text: string } | null {
    if (!this.preserveModelOutput || part.toolInvocation.state !== 'result') {
      return null;
    }

    const mastraMetadata = part.providerMetadata?.mastra;
    if (!mastraMetadata || !Object.hasOwn(mastraMetadata, 'modelOutput')) {
      return null;
    }

    const modelOutput = mastraMetadata.modelOutput;
    if (modelOutput == null) {
      return null;
    }

    const text = this.modelOutputToText(modelOutput);
    if (!text) {
      return null;
    }

    return {
      type: 'text',
      text: `${part.toolInvocation.toolName} result:\n${text}`,
    };
  }

  private modelOutputToText(modelOutput: unknown): string | null {
    if (typeof modelOutput === 'string') {
      return modelOutput;
    }

    if (typeof modelOutput === 'number' || typeof modelOutput === 'boolean' || typeof modelOutput === 'bigint') {
      return String(modelOutput);
    }

    if (Array.isArray(modelOutput)) {
      const text = modelOutput
        .map(part => this.modelOutputToText(part))
        .filter((part): part is string => Boolean(part))
        .join('\n');
      return text || this.safeStringify(modelOutput);
    }

    if (modelOutput && typeof modelOutput === 'object') {
      const output = modelOutput as Record<string, unknown>;
      if (output.type === 'text') {
        if (typeof output.value === 'string') {
          return output.value;
        }
        if (typeof output.text === 'string') {
          return output.text;
        }
      }

      if ('value' in output) {
        return this.modelOutputToText(output.value);
      }

      if ('text' in output && typeof output.text === 'string') {
        return output.text;
      }

      return this.safeStringify(modelOutput);
    }

    return null;
  }

  private safeStringify(value: unknown): string | null {
    try {
      return JSON.stringify(value);
    } catch {
      return null;
    }
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

        const nonToolParts = message.content.parts.flatMap((part: any) => {
          if (part.type !== 'tool-invocation') {
            return [part];
          }

          const toolCallId = this.getToolCallId(part.toolInvocation);
          if (toolCallId && preserveToolCallIds.has(toolCallId)) {
            return [part];
          }

          const modelOutputPart = this.getPreservedModelOutputPart(part);
          return modelOutputPart ? [modelOutputPart] : [];
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
          const toolCallId = this.getToolCallId(invocation);
          if (toolCallId) {
            excludedToolCallIds.add(toolCallId);
          }
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

        const filteredParts = message.content.parts.flatMap((part: any) => {
          if (part.type !== 'tool-invocation') {
            return [part];
          }

          const invocationPart = part as unknown as V2ToolInvocationPart;
          const invocation = invocationPart.toolInvocation;
          const toolCallId = this.getToolCallId(invocation);

          if (toolCallId && preserveToolCallIds.has(toolCallId)) {
            return [part];
          }

          const shouldExclude =
            (invocation.state === 'call' && this.exclude.includes(invocation.toolName)) ||
            (invocation.state === 'result' && toolCallId !== undefined && excludedToolCallIds.has(toolCallId)) ||
            (invocation.state === 'result' && this.exclude.includes(invocation.toolName));

          if (!shouldExclude) {
            return [part];
          }

          const modelOutputPart = this.getPreservedModelOutputPart(invocationPart);
          return modelOutputPart ? [modelOutputPart] : [];
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
              preserveToolCallIds.has(inv.toolCallId ?? inv.toolCall?.id) ||
              (!this.exclude.includes(inv.toolName) && !excludedToolCallIds.has(inv.toolCallId ?? inv.toolCall?.id)),
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
