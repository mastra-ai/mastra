import type { Mastra } from '..';
import type { AgentBackgroundConfig } from '../background-tasks';
import type { MastraLegacyLanguageModel } from '../llm/model/shared.types';
import type { MastraLanguageModel, MastraMemory } from '../memory';
import type { RequestContext } from '../request-context';
import type { ChunkType, FullOutput, MastraModelOutput } from '../stream';
import type { DynamicArgument } from '../types';
import type { MessageListInput } from './message-list';
import type { AgentInstructions, MastraDBMessage, MessageList } from './types';

/**
 * Minimal interface for objects that can be used as subagents in the `agents` field.
 * `Agent` already satisfies this interface. Implement this to create lighter-weight
 * subagents without the full Agent class.
 */
export type SubAgentToolResult = {
  payload: {
    toolName: string;
    toolCallId: string;
    result?: unknown;
    args?: unknown;
    isError?: boolean;
  };
};

export type SubAgentGenerateResult = Pick<FullOutput, 'text' | 'finishReason' | 'runId'> & {
  response: { dbMessages?: MastraDBMessage[] };
  toolResults?: SubAgentToolResult[];
  suspendPayload?: unknown;
  resumeSchema?: unknown;
  usage?: FullOutput['usage'];
};

export type SubAgentStreamResult = {
  fullStream: ReadableStream<ChunkType>;
  text: Promise<string>;
  usage?: Promise<unknown>;
  messageList: MessageList;
  toolResults?: SubAgentToolResult[] | Promise<SubAgentToolResult[]>;
  runId: string;
};

export interface SubAgent<TId = string, TRequestContext extends Record<string, any> | unknown = unknown> {
  /** Unique identifier for this subagent */
  readonly id: TId;

  /** Human-readable name used in logs and error details */
  readonly name?: string;

  /** Human-readable description used for the generated tool description */
  getDescription(): string;

  /** Returns the model instance used to select the execution path. */
  getModel(opts?: {
    requestContext?: RequestContext;
  }): MastraLanguageModel | MastraLegacyLanguageModel | Promise<MastraLanguageModel | MastraLegacyLanguageModel>;

  /** Whether this subagent has its own memory configured */
  hasOwnMemory(): boolean;

  /** Inject parent memory into this subagent when it does not have its own */
  __setMemory(memory: DynamicArgument<MastraMemory, TRequestContext>): void;

  /** Returns the memory instance, if configured */
  getMemory(opts?: { requestContext?: RequestContext }): Promise<MastraMemory | undefined> | MastraMemory | undefined;

  /** Returns the system prompt / instructions */
  getInstructions(opts?: { requestContext?: RequestContext }): AgentInstructions | Promise<AgentInstructions>;

  /** Execute a prompt and return the full result */
  generate(messages: MessageListInput, options?: any): Promise<FullOutput | SubAgentGenerateResult>;

  /** Stream a prompt execution */
  stream(messages: MessageListInput, options?: any): Promise<MastraModelOutput | SubAgentStreamResult>;

  /** Resume a previously suspended generate execution */
  resumeGenerate(resumeData: any, options?: any): Promise<FullOutput | SubAgentGenerateResult>;

  /** Resume a previously suspended stream execution */
  resumeStream(resumeData: any, options?: any): Promise<MastraModelOutput | SubAgentStreamResult>;

  /**
   * Execute a prompt using a legacy v1 model
   * @deprecated Use generate instead
   */
  generateLegacy?(messages: MessageListInput, options?: any): Promise<any>;

  /**
   * Stream a prompt execution using a legacy v1 model
   * @deprecated Use stream instead
   */
  streamLegacy?(messages: MessageListInput, options?: any): Promise<any>;

  /** Register a Mastra instance on implementations that need it */
  __registerMastra?(mastra: Mastra): void;

  /** Returns background task configuration, if configured */
  getBackgroundTasksConfig?(): AgentBackgroundConfig | undefined;
}

export function isAgentCompatible<TId extends string>(input: unknown): input is SubAgent<TId, any> {
  if (typeof input !== 'object' || input === null) {
    return false;
  }

  const candidate = input as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.generate === 'function' &&
    typeof candidate.stream === 'function' &&
    typeof candidate.getDescription === 'function' &&
    typeof candidate.getModel === 'function' &&
    typeof candidate.hasOwnMemory === 'function' &&
    typeof candidate.__setMemory === 'function' &&
    typeof candidate.getMemory === 'function' &&
    typeof candidate.getInstructions === 'function' &&
    typeof candidate.resumeGenerate === 'function' &&
    typeof candidate.resumeStream === 'function'
  );
}
