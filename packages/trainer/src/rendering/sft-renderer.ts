import type { AgentMessage, Scorecard } from '../types';
import { toJsonlBuffer } from './jsonl';

/**
 * OpenAI chat fine-tuning message format.
 */
interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

/**
 * OpenAI chat fine-tuning example format.
 */
interface OpenAIChatExample {
  messages: OpenAIChatMessage[];
}

/**
 * Render scorecards to SFT (Supervised Fine-Tuning) JSONL format.
 *
 * The format follows OpenAI's chat fine-tuning format:
 * {"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
 */
export function renderSftJsonl(scorecards: Scorecard[]): Uint8Array {
  const examples: OpenAIChatExample[] = [];

  for (const scorecard of scorecards) {
    // Only include examples that passed gates
    if (!scorecard.passedGates) {
      continue;
    }

    const messages = convertToOpenAIMessages(scorecard.run.input.messages);

    // Ensure we have at least a user message and assistant response
    const hasUser = messages.some(m => m.role === 'user');
    const hasAssistant = messages.some(m => m.role === 'assistant');

    if (hasUser && hasAssistant) {
      examples.push({ messages });
    }
  }

  return toJsonlBuffer(examples);
}

/**
 * Convert internal messages to OpenAI format.
 */
function convertToOpenAIMessages(messages: AgentMessage[]): OpenAIChatMessage[] {
  return messages.map(msg => {
    const openAIMsg: OpenAIChatMessage = {
      role: msg.role,
      content: msg.content,
    };

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      openAIMsg.tool_calls = msg.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    if (msg.toolCallId) {
      openAIMsg.tool_call_id = msg.toolCallId;
    }

    if (msg.name) {
      openAIMsg.name = msg.name;
    }

    return openAIMsg;
  });
}

/**
 * Render options for SFT.
 */
export interface SftRenderOptions {
  /** Include system messages */
  includeSystem?: boolean;
  /** Maximum messages per example */
  maxMessages?: number;
  /** Include metadata as a comment in the last assistant message */
  includeMetadata?: boolean;
}

/**
 * Render scorecards to SFT format with options.
 */
export function renderSftJsonlWithOptions(scorecards: Scorecard[], options: SftRenderOptions = {}): Uint8Array {
  const examples: OpenAIChatExample[] = [];

  for (const scorecard of scorecards) {
    if (!scorecard.passedGates) {
      continue;
    }

    let messages = convertToOpenAIMessages(scorecard.run.input.messages);

    // Filter system messages if needed
    if (options.includeSystem === false) {
      messages = messages.filter(m => m.role !== 'system');
    }

    // Truncate if needed
    if (options.maxMessages && messages.length > options.maxMessages) {
      // Keep system (if any), then take most recent messages
      const systemMsgs = messages.filter(m => m.role === 'system');
      const nonSystemMsgs = messages.filter(m => m.role !== 'system');
      const truncatedNonSystem = nonSystemMsgs.slice(-(options.maxMessages - systemMsgs.length));
      messages = [...systemMsgs, ...truncatedNonSystem];
    }

    const hasUser = messages.some(m => m.role === 'user');
    const hasAssistant = messages.some(m => m.role === 'assistant');

    if (hasUser && hasAssistant) {
      examples.push({ messages });
    }
  }

  return toJsonlBuffer(examples);
}

/**
 * Get statistics about the rendered SFT data.
 */
export function getSftStats(scorecards: Scorecard[]): {
  total: number;
  passed: number;
  failed: number;
  avgMessages: number;
  avgScore: number;
} {
  const passed = scorecards.filter(s => s.passedGates);
  const failed = scorecards.filter(s => !s.passedGates);

  const totalMessages = passed.reduce((sum, s) => sum + s.run.input.messages.length, 0);

  const totalScore = passed.reduce((sum, s) => sum + s.compositeScore, 0);

  return {
    total: scorecards.length,
    passed: passed.length,
    failed: failed.length,
    avgMessages: passed.length > 0 ? totalMessages / passed.length : 0,
    avgScore: passed.length > 0 ? totalScore / passed.length : 0,
  };
}
