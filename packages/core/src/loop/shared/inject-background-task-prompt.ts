import type { LanguageModelV2Prompt } from '@ai-sdk/provider-v5';
import type { AgentBackgroundConfig, BackgroundTaskManager } from '../../background-tasks';
import { generateBackgroundTaskSystemPrompt } from '../../background-tasks';

export interface InjectBackgroundTaskPromptOptions {
  /** Current LLM input messages — returned untouched when injection is skipped. */
  inputMessages: LanguageModelV2Prompt;
  /**
   * Active background-task manager. When absent the helper is a no-op so the
   * caller does not need to gate the helper themselves.
   */
  backgroundTaskManager?: BackgroundTaskManager;
  /** Tools available on the current step. Required for prompt generation. */
  tools?: Record<string, { background?: any; description?: string }>;
  /** Agent-level background-task configuration. */
  agentBackgroundConfig?: AgentBackgroundConfig;
}

/**
 * Append `generateBackgroundTaskSystemPrompt(...)` output to the leading
 * system message of an LLM prompt. Returns the messages unchanged when there
 * is no background-task manager, no tools, or the prompt generator returns
 * `undefined` (no eligible tools).
 *
 * Both the regular agentic loop and the durable workflow call this helper at
 * the same injection point to keep behaviour identical.
 */
export function injectBackgroundTaskPrompt({
  inputMessages,
  backgroundTaskManager,
  tools,
  agentBackgroundConfig,
}: InjectBackgroundTaskPromptOptions): LanguageModelV2Prompt {
  if (!backgroundTaskManager || !tools || agentBackgroundConfig?.disabled) {
    return inputMessages;
  }

  const bgPrompt = generateBackgroundTaskSystemPrompt(tools, agentBackgroundConfig);
  if (!bgPrompt) {
    return inputMessages;
  }

  // Return a new array AND new message objects — never mutate caller-owned
  // prompt objects, otherwise reusing the same prompt later would
  // accumulate duplicate background-task guidance.
  return inputMessages.map((message, index) => {
    if (message.role === 'system' && index === 0) {
      return { ...message, content: message.content + `\n\n${bgPrompt}` };
    }
    return message;
  });
}
