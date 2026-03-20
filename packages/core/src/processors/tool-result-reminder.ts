import type { MessageList } from '../agent/message-list';
import type { Processor, ProcessInputStepArgs } from './index';

/**
 * Type definition for tool invocation in MastraDBMessage format 2
 * Note: The full ToolInvocation type includes 'partial-call' state which we don't need to handle
 */
type V2ToolInvocation = {
  toolName: string;
  toolCallId: string;
  args: unknown;
  result?: unknown;
  state: string;
};

/**
 * Options for ToolResultReminderProcessor
 */
export interface ToolResultReminderOptions {
  /** The reminder text to inject when tool results are detected */
  reminderText: string;
  /**
   * Tag used for duplicate suppression.
   * If a system message with this tag was already added in this step (by another processor),
   * this processor will not add a duplicate.
   * Defaults to 'tool-result-reminder'.
   */
  tag?: string;
}

/**
 * A processInputStep processor that injects a system reminder when tool-result messages
 * are detected in the prompt-visible history.
 *
 * This runs at every step of the agentic loop (including tool-call continuations).
 * When tool-result history is present and no duplicate reminder is already in the
 * current step's system messages, a tagged system reminder is added via messageList.addSystem.
 *
 * Duplicate suppression is automatic: addSystem with a tag prevents the same content
 * from being added twice in a single step (content equality check within the tag bucket).
 * The per-step replaceAllSystemMessages() clears all tagged system messages at the
 * start of each step, so the reminder is independently re-evaluated each step.
 *
 * Tool-result detection works in two scenarios:
 * 1. Production: After tool execution, updateToolInvocation stores results in message.content.parts
 *    with type 'tool-invocation' and toolInvocation.state === 'result'.
 * 2. Legacy/direct storage: Messages may have toolInvocations array with state 'result'.
 */
export class ToolResultReminderProcessor implements Processor<'tool-result-reminder'> {
  readonly id = 'tool-result-reminder' as const;
  readonly name = 'Tool Result Reminder';
  private readonly reminderText: string;
  private readonly tag: string;

  constructor(options: ToolResultReminderOptions) {
    this.reminderText = options.reminderText;
    this.tag = options.tag ?? 'tool-result-reminder';
  }

  async processInputStep({ messageList }: ProcessInputStepArgs): Promise<MessageList | undefined> {
    // Check prompt-visible history for tool-result messages
    const messages = messageList.get.all.db();

    // Detect tool results in messages.
    // After tool execution, updateToolInvocation stores results in message.content.parts
    // with type 'tool-invocation' and toolInvocation.state === 'result'.
    const hasToolResults = messages.some(m => {
      // Check parts array for tool-invocation with state 'result'
      const hasToolResultInParts = m.content.parts?.some(
        part => part.type === 'tool-invocation' && part.toolInvocation?.state === 'result',
      );
      if (hasToolResultInParts) {
        return true;
      }

      // Also check toolInvocations array (legacy/direct storage format)
      const hasToolResultInInvocations = m.content.toolInvocations?.some(
        (inv: V2ToolInvocation) => inv.state === 'result',
      );
      if (hasToolResultInInvocations) {
        return true;
      }

      return false;
    });

    if (!hasToolResults) {
      return undefined;
    }

    // addSystem with tag handles duplicate suppression within the step:
    // - If a system message with the same content is already in taggedSystemMessages[tag],
    //   the second call is a no-op (isDuplicateSystem returns true).
    // - replaceAllSystemMessages at the start of each step clears taggedSystemMessages,
    //   so this processor re-evaluates independently each step.
    messageList.addSystem(this.reminderText, this.tag);

    return messageList;
  }
}
