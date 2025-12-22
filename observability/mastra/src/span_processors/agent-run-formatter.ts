import type { AnySpan, SpanOutputProcessor } from '@mastra/core/observability';
import { SpanType } from '@mastra/core/observability';

/**
 * AgentRunFormatter
 *
 * A SpanOutputProcessor that simplifies AGENT_RUN span input/output.
 *
 * Input rules:
 * - If single user message → extract content text
 * - Otherwise → no transformation
 *
 * Output rules:
 * - If object has exactly ONE non-empty property → return that value directly
 * - Otherwise → no transformation (return as-is)
 *
 * @example
 * // Input: { messages: [{ role: 'user', content: 'Hello' }] }
 * // After: 'Hello'
 *
 * // Output: { text: "Hello world", object: undefined, files: [] }
 * // After: "Hello world"
 */
export class AgentRunFormatter implements SpanOutputProcessor {
  name = 'agent-run-formatter';

  /**
   * Process a span by simplifying AGENT_RUN input/output.
   * Non-AGENT_RUN spans are returned unchanged.
   */
  process(span?: AnySpan): AnySpan | undefined {
    if (!span || span.type !== SpanType.AGENT_RUN) {
      return span;
    }

    span.input = this.simplifyInput(span.input);
    span.output = this.simplifyOutput(span.output);
    return span;
  }

  /**
   * Simplify input by extracting content from single user message.
   * Input format: { messages: [{ role: 'user', content: 'text' }] }
   * If single user message, return the content text.
   */
  private simplifyInput(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const obj = value as Record<string, unknown>;
    if (!('messages' in obj) || !Array.isArray(obj.messages) || obj.messages.length !== 1) {
      return value;
    }

    const message = obj.messages[0];
    if (
      message &&
      typeof message === 'object' &&
      'role' in message &&
      message.role === 'user' &&
      'content' in message
    ) {
      return message.content;
    }

    return value;
  }

  /**
   * Simplify output by extracting single non-empty property.
   * Returns original value if not an object, or if multiple/zero non-empty properties.
   */
  private simplifyOutput(value: unknown): unknown {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return value;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const nonEmpty = entries.filter(([_, v]) => this.hasValue(v));

    if (nonEmpty.length === 1) {
      return nonEmpty[0]?.[1];
    }

    return value;
  }

  /**
   * Check if a value is considered "non-empty".
   * Empty values: undefined, null, empty string, empty array.
   */
  private hasValue(v: unknown): boolean {
    if (v === undefined || v === null || v === '') {
      return false;
    }
    if (Array.isArray(v) && v.length === 0) {
      return false;
    }
    return true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }
}
