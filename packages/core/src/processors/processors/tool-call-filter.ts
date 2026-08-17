import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';

import type { ProcessLLMRequestArgs, ProcessLLMRequestResult, Processor } from '../index';

type PromptMessage = LanguageModelV2Prompt[number];
type PromptPart = Extract<PromptMessage, { role: 'assistant' }>['content'][number];
type ToolCallPart = Extract<PromptPart, { type: 'tool-call' }>;
type ToolResultPart = Extract<PromptPart, { type: 'tool-result' }>;

/** Per-request state key holding the tool call ids present before the loop started. */
const HISTORY_TOOL_CALL_IDS = '__toolCallFilterHistoryToolCallIds';

export type ToolCallFilterOptions = {
  exclude?: string[];
  filterAfterToolSteps?: number;
  preserveModelOutput?: boolean;
};

/**
 * Filters out tool calls and results from the prompt sent to the model.
 * By default (with no arguments), excludes all tool calls and their results.
 * Can be configured to exclude only specific tools by name.
 *
 * Filtering happens in `processLLMRequest`, which runs after the message list
 * has been converted to a provider prompt. Changes are transient: they only
 * affect what this model call receives and are never written back to the
 * message list, memory, or UI history. Stored messages keep their full
 * tool-invocation parts.
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
   * @param options.filterAfterToolSteps Preserve tool calls/results from this many recent tool-producing steps.
   * @param options.preserveModelOutput Replace filtered tool results with their compact model-facing output as text.
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

  async processLLMRequest({ prompt, state }: ProcessLLMRequestArgs): Promise<ProcessLLMRequestResult> {
    if (this.exclude !== 'all' && this.exclude.length === 0) {
      return undefined;
    }

    const preservedToolCallIds = this.getPreservedToolCallIds(prompt, state);
    const excludedToolCallIds = this.getExcludedToolCallIds(prompt, preservedToolCallIds);
    if (excludedToolCallIds.size === 0) {
      return undefined;
    }

    const replacementTexts = this.getReplacementTexts(prompt, excludedToolCallIds);
    const idsWithToolCallPart = this.getToolCallPartIds(prompt);

    const filtered: LanguageModelV2Prompt = [];
    let changed = false;

    for (const message of prompt) {
      if (message.role === 'system' || message.role === 'user') {
        filtered.push(message);
        continue;
      }

      const content: PromptPart[] = [];
      let messageChanged = false;

      for (const part of message.content as PromptPart[]) {
        const toolCallId = this.getPartToolCallId(part);
        if (!toolCallId || !excludedToolCallIds.has(toolCallId)) {
          content.push(part);
          continue;
        }

        changed = true;
        messageChanged = true;

        // A call/result pair collapses into a single text part, emitted where the
        // tool call was so message roles stay valid. Provider-executed results that
        // have no matching tool call emit in place instead.
        const emitsText =
          part.type === 'tool-call' || (message.role === 'assistant' && !idsWithToolCallPart.has(toolCallId));
        if (emitsText) {
          const text = replacementTexts.get(toolCallId);
          if (text) {
            content.push({ type: 'text', text });
          }
        }
      }

      if (content.length === 0) {
        // Dropping the message entirely avoids sending an empty assistant or
        // tool message, which providers reject.
        continue;
      }

      filtered.push(messageChanged ? ({ ...message, content } as PromptMessage) : message);
    }

    if (!changed) {
      return undefined;
    }

    return { prompt: filtered };
  }

  /**
   * Tool call ids that must survive filtering.
   *
   * When `filterAfterToolSteps` is not configured, only prior history is filtered:
   * every tool call produced by the current run stays in the prompt so the loop can
   * still act on the results it just produced.
   *
   * When it is configured, the most recent `filterAfterToolSteps` tool-producing steps
   * are preserved instead. Each assistant message containing tool calls counts as one
   * step, in prompt order, so history and the current run are treated the same way.
   */
  private getPreservedToolCallIds(prompt: LanguageModelV2Prompt, state: Record<string, unknown>): Set<string> {
    if (this.filterAfterToolSteps === undefined) {
      // The first prompt of a request is the pre-loop history. Every tool call id seen
      // after that belongs to the current run and is preserved.
      const historyToolCallIds = (state[HISTORY_TOOL_CALL_IDS] ??= this.getToolCallIds(prompt)) as Set<string>;
      return new Set([...this.getToolCallIds(prompt)].filter(id => !historyToolCallIds.has(id)));
    }

    const preserveStepCount = Math.max(0, this.filterAfterToolSteps);
    if (preserveStepCount === 0) {
      return new Set();
    }

    const promptToolSteps: string[][] = [];
    for (const message of prompt) {
      if (message.role !== 'assistant') continue;
      const stepToolCallIds = message.content
        .filter((part): part is ToolCallPart => part.type === 'tool-call')
        .map(part => part.toolCallId);
      if (stepToolCallIds.length > 0) {
        promptToolSteps.push(stepToolCallIds);
      }
    }

    return new Set(promptToolSteps.slice(-preserveStepCount).flat());
  }

  /**
   * Resolves which tool call ids to remove. Ids are always excluded as a
   * call/result pair so no dangling tool call or orphaned tool result is sent.
   */
  private getExcludedToolCallIds(prompt: LanguageModelV2Prompt, preservedToolCallIds: Set<string>): Set<string> {
    const excluded = new Set<string>();

    for (const message of prompt) {
      if (message.role === 'system' || message.role === 'user') continue;

      for (const part of message.content as PromptPart[]) {
        if (part.type !== 'tool-call' && part.type !== 'tool-result') continue;
        if (preservedToolCallIds.has(part.toolCallId)) continue;
        if (this.exclude === 'all' || this.exclude.includes(part.toolName)) {
          excluded.add(part.toolCallId);
        }
      }
    }

    return excluded;
  }

  /**
   * Compact model-facing text for each excluded tool result, used when
   * `preserveModelOutput` is enabled. The prompt's `output` already reflects
   * `providerMetadata.mastra.modelOutput` when the tool defines `toModelOutput`.
   */
  private getReplacementTexts(prompt: LanguageModelV2Prompt, excludedToolCallIds: Set<string>): Map<string, string> {
    const texts = new Map<string, string>();
    if (!this.preserveModelOutput) {
      return texts;
    }

    for (const message of prompt) {
      if (message.role === 'system' || message.role === 'user') continue;

      for (const part of message.content as PromptPart[]) {
        if (part.type !== 'tool-result') continue;
        if (!excludedToolCallIds.has(part.toolCallId)) continue;

        const text = this.modelOutputToText((part as ToolResultPart).output);
        if (text) {
          texts.set(part.toolCallId, `${part.toolName} result:\n${text}`);
        }
      }
    }

    return texts;
  }

  private getToolCallIds(prompt: LanguageModelV2Prompt): Set<string> {
    const ids = new Set<string>();
    for (const message of prompt) {
      if (message.role === 'system' || message.role === 'user') continue;
      for (const part of message.content as PromptPart[]) {
        const toolCallId = this.getPartToolCallId(part);
        if (toolCallId) ids.add(toolCallId);
      }
    }
    return ids;
  }

  private getToolCallPartIds(prompt: LanguageModelV2Prompt): Set<string> {
    const ids = new Set<string>();
    for (const message of prompt) {
      if (message.role !== 'assistant') continue;
      for (const part of message.content) {
        if (part.type === 'tool-call') {
          ids.add(part.toolCallId);
        }
      }
    }
    return ids;
  }

  private getPartToolCallId(part: PromptPart): string | undefined {
    return part.type === 'tool-call' || part.type === 'tool-result' ? part.toolCallId : undefined;
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
}
