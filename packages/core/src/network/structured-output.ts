import type { OutputSchema } from '../stream';

/**
 * Represents the result of a tool call made during agent execution
 */
export interface ToolCallResult {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

/**
 * Represents a single execution step in the network
 */
export interface NetworkExecutionStep {
  stepId: string;
  primitiveId: string;
  primitiveType: 'agent' | 'workflow' | 'tool';
  primitiveDescription?: string;
  status: 'pending' | 'executing' | 'success' | 'error';
  input: unknown;
  output?: unknown;
  error?: string;
  toolCalls?: ToolCallResult[];
  duration: number;
  timestamp: string;
}

/**
 * Represents the final message and its metadata
 */
export interface NetworkFinalResult {
  text: string;
  output?: unknown;
  reasoning?: string;
  sources?: Array<{
    type: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Token usage information
 */
export interface NetworkTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedInputTokens?: number;
}

/**
 * Structured output for network execution
 */
export interface NetworkStructuredOutput<OUTPUT extends OutputSchema = undefined> {
  networkId: string;
  runId: string;
  steps: NetworkExecutionStep[];
  finalResult: NetworkFinalResult;
  totalIterations: number;
  tokenUsage: NetworkTokenUsage;
  status: 'success' | 'error' | 'incomplete';
  error?: string;
  startTime: string;
  endTime: string;
  durationMs: number;
}

/**
 * Options for configuring structured output behavior
 */
export interface StructuredNetworkOutputOptions {
  /**
   * Whether to include tool calls in the output
   * @default true
   */
  includeToolCalls?: boolean;

  /**
   * Whether to include intermediate steps in the output
   * @default true
   */
  includeSteps?: boolean;

  /**
   * Whether to include reasoning information
   * @default false
   */
  includeReasoning?: boolean;

  /**
   * Whether to include sources information
   * @default false
   */
  includeSources?: boolean;

  /**
   * Maximum number of steps to track
   * @default unlimited
   */
  maxSteps?: number;
}
