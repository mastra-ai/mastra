import type { TransformStreamDefaultController } from 'node:stream/web';
import { Agent } from '../../agent';
import type { MessageInput, MessageListInput } from '../../agent/message-list';
import type { StructuredOutputOptions } from '../../agent/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { MastraModelConfig } from '../../llm/model/shared.types';
import type { IMastraLogger } from '../../logger';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '../../request-context';
import type { StandardSchemaWithJSON } from '../../schema';
import { ChunkFrom } from '../../stream';
import type { ChunkType } from '../../stream';
import type { ToolCallChunk, ToolResultChunk } from '../../stream/types';
import type { ProcessOutputStreamArgs, Processor } from '../index';

export type { StructuredOutputOptions } from '../../agent/types';

export const STRUCTURED_OUTPUT_PROCESSOR_NAME = 'structured-output';

/**
 * StructuredOutputProcessor transforms unstructured agent output into structured JSON
 * using an internal structuring agent and provides real-time streaming support.
 *
 * Features:
 * - Two-stage processing: unstructured → structured using internal agent
 * - Real-time partial JSON parsing during streaming
 * - Schema validation with Zod
 * - Object chunks for partial updates
 * - Configurable error handling strategies
 * - Automatic instruction generation based on schema
 */
export class StructuredOutputProcessor<OUTPUT extends {}> implements Processor<'structured-output'> {
  readonly id = STRUCTURED_OUTPUT_PROCESSOR_NAME;
  readonly name = 'Structured Output';

  public schema: StandardSchemaWithJSON<OUTPUT>;
  private structuringAgent: Agent<any, any, undefined>;
  private structuringModel: MastraModelConfig;
  private structuringInstructions: string;
  private agent?: Agent<any, any, any>;
  private useAgent = false;
  private errorStrategy: 'strict' | 'warn' | 'fallback';
  private fallbackValue?: OUTPUT;
  private isStructuringAgentStreamStarted = false;
  private jsonPromptInjection?: boolean;
  private providerOptions?: ProviderOptions;
  private logger?: IMastraLogger;

  constructor(options: StructuredOutputOptions<OUTPUT>) {
    if (!options.schema) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_PROCESSOR_SCHEMA_REQUIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'StructuredOutputProcessor requires a schema to be provided',
      });
    }
    if (!options.model) {
      throw new MastraError({
        id: 'STRUCTURED_OUTPUT_PROCESSOR_MODEL_REQUIRED',
        domain: ErrorDomain.AGENT,
        category: ErrorCategory.USER,
        text: 'StructuredOutputProcessor requires a model to be provided either in options or as fallback',
      });
    }

    this.schema = options.schema;
    this.structuringModel = options.model;
    this.useAgent = options.useAgent ?? false;
    this.errorStrategy = options.errorStrategy ?? 'strict';
    this.fallbackValue = options.fallbackValue;
    this.jsonPromptInjection = options.jsonPromptInjection;
    this.providerOptions = options.providerOptions;
    this.logger = options.logger;
    this.structuringInstructions = options.instructions || this.generateInstructions();
    // Create internal structuring agent as fallback (used when no explicit agent is set)
    this.structuringAgent = new Agent({
      id: 'structured-output-structurer',
      name: 'structured-output-structurer',
      instructions: this.structuringInstructions,
      model: options.model,
    });
  }

  __registerMastra(mastra: Mastra) {
    this.structuringAgent.__registerMastra(mastra);
  }

  setAgent(agent: Agent<any, any, any>) {
    this.agent = agent;
  }

  async processOutputStream(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    const { part, state, streamParts, abort, requestContext, messageList, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);
    const controller = state.controller as TransformStreamDefaultController<ChunkType<OUTPUT>> | undefined;

    switch (part.type) {
      case 'finish':
        // The main stream is finished, intercept it and start the structuring agent stream
        // - enqueue the structuring agent stream chunks into the main stream
        // - when the structuring agent stream is finished, enqueue the final chunk into the main stream

        await this.processAndEmitStructuredOutput(
          streamParts,
          controller,
          abort,
          observabilityContext,
          requestContext,
          messageList,
        );
        return part;

      default:
        return part;
    }
  }

  private async processAndEmitStructuredOutput(
    streamParts: ChunkType[],
    controller: TransformStreamDefaultController<ChunkType<OUTPUT>> | undefined,
    abort: ProcessOutputStreamArgs['abort'],
    observabilityContext?: ObservabilityContext,
    requestContext?: RequestContext,
    messageList?: ProcessOutputStreamArgs['messageList'],
  ): Promise<void> {
    if (this.isStructuringAgentStreamStarted) return;
    this.isStructuringAgentStreamStarted = true;
    try {
      const structuringAgentStream = await this.getStructuringStream(
        streamParts,
        requestContext,
        messageList,
        observabilityContext,
      );

      const excludedChunkTypes = [
        'start',
        'finish',
        'text-start',
        'text-delta',
        'text-end',
        'step-start',
        'step-finish',
      ];

      // Stream object chunks directly into the main stream
      for await (const chunk of structuringAgentStream.fullStream) {
        if (excludedChunkTypes.includes(chunk.type) || chunk.type.startsWith('data-')) {
          continue;
        }
        if (chunk.type === 'error') {
          this.handleError('Structuring failed', chunk.payload.error, abort);

          if (this.errorStrategy === 'warn') {
            // avoid enqueuing the error chunk to the main agent stream
            break;
          }
          if (this.errorStrategy === 'fallback' && this.fallbackValue !== undefined) {
            const fallbackChunk: ChunkType<OUTPUT> = {
              runId: chunk.runId,
              from: ChunkFrom.AGENT,
              type: 'object-result',
              object: this.fallbackValue,
              metadata: {
                from: 'structured-output',
                fallback: true,
              },
            };
            controller?.enqueue(fallbackChunk);
            break;
          }
        }

        const newChunk = {
          ...chunk,
          metadata: {
            from: 'structured-output',
          },
        } as unknown as ChunkType<OUTPUT>;
        controller?.enqueue(newChunk);
      }
    } catch (error) {
      this.handleError('Structured output processing failed', error, abort);
    }
  }

  /**
   * Get the structuring stream, using the explicit agent with model override and
   * read-only memory when request context provides thread info, falling back to the bare internal agent.
   */
  private async getStructuringStream(
    streamParts: ChunkType[],
    requestContext?: RequestContext,
    messageList?: ProcessOutputStreamArgs['messageList'],
    observabilityContext?: ObservabilityContext,
  ) {
    const requestThreadId = requestContext?.get(MASTRA_THREAD_ID_KEY);
    const requestResourceId = requestContext?.get(MASTRA_RESOURCE_ID_KEY);
    const serializedMemoryInfo = messageList?.serialize().memoryInfo;
    const threadId =
      typeof requestThreadId === 'string'
        ? requestThreadId
        : typeof serializedMemoryInfo?.threadId === 'string'
          ? serializedMemoryInfo.threadId
          : undefined;
    const resourceId =
      typeof requestResourceId === 'string'
        ? requestResourceId
        : typeof serializedMemoryInfo?.resourceId === 'string'
          ? serializedMemoryInfo.resourceId
          : undefined;

    // When opted in and an explicit agent is available with thread info,
    // use that agent with a model override and read-only memory.
    // This gives the structuring model full conversation context.
    if (this.useAgent && this.agent && threadId) {
      const promptMessage: MessageInput = {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Extract and structure information from the conversation so far. keep the original meaning and details. Rely on the provided text and conversation history`,
          },
        ],
      };

      const messages: MessageListInput = [
        ...(messageList?.get?.input?.db() || []),
        ...(messageList?.get?.response?.db() || []),
        promptMessage,
      ];

      const structuringRequestContext = requestContext ? new RequestContext(requestContext.entries()) : undefined;

      return this.agent.stream(messages, {
        model: this.structuringModel,
        requestContext: structuringRequestContext,
        toolChoice: 'none',
        structuredOutput: {
          schema: this.schema,
          jsonPromptInjection: this.jsonPromptInjection,
        },
        memory: {
          thread: threadId,
          ...(resourceId ? { resource: resourceId } : {}),
          options: { readOnly: true },
        },
        providerOptions: this.providerOptions,
        ...observabilityContext,
      });
    }

    // Fallback: use the bare internal structuring agent (no conversation context)
    return this.structuringAgent.stream(
      `Extract and structure the key information from the following text according to the specified schema. Keep the original meaning and details. Rely on the provided text and conversation history.\n\n${this.buildStructuringPrompt(streamParts)}`,
      {
        structuredOutput: {
          schema: this.schema,
          jsonPromptInjection: this.jsonPromptInjection,
        },
        providerOptions: this.providerOptions,
        ...observabilityContext,
      },
    );
  }

  /**
   * Build a structured markdown prompt from stream parts
   * Collects chunks by type and formats them in a consistent structure
   */
  private buildStructuringPrompt(streamParts: ChunkType[]): string {
    const textChunks: string[] = [];
    const reasoningChunks: string[] = [];
    const toolCalls: ToolCallChunk[] = [];
    const toolResults: ToolResultChunk[] = [];

    // Collect chunks by type
    for (const part of streamParts) {
      switch (part.type) {
        case 'text-delta':
          textChunks.push(part.payload.text);
          break;
        case 'reasoning-delta':
          reasoningChunks.push(part.payload.text);
          break;
        case 'tool-call':
          toolCalls.push(part);
          break;
        case 'tool-result':
          toolResults.push(part);
          break;
      }
    }

    const sections: string[] = [];
    if (reasoningChunks.length > 0) {
      sections.push(`# Assistant Reasoning\n${reasoningChunks.join('')}`);
    }
    if (toolCalls.length > 0) {
      const toolCallsText = toolCalls
        .map(tc => {
          const args = typeof tc.payload.args === 'object' ? JSON.stringify(tc.payload.args, null) : tc.payload.args;
          const output =
            tc.payload.output !== undefined
              ? `${typeof tc.payload.output === 'object' ? JSON.stringify(tc.payload.output, null) : tc.payload.output}`
              : '';
          return `## ${tc.payload.toolName}\n### Input: ${args}\n### Output: ${output}`;
        })
        .join('\n');
      sections.push(`# Tool Calls\n${toolCallsText}`);
    }

    if (toolResults.length > 0) {
      const resultsText = toolResults
        .map(tr => {
          const result = tr.payload.result;
          if (result === undefined || result === null) {
            return `${tr.payload.toolName}: null`;
          }
          return `${tr.payload.toolName}: ${typeof result === 'object' ? JSON.stringify(result, null, 2) : result}`;
        })
        .join('\n');
      sections.push(`# Tool Results\n${resultsText}`);
    }
    if (textChunks.length > 0) {
      sections.push(`# Assistant Response\n${textChunks.join('')}`);
    }

    return sections.join('\n\n');
  }

  /**
   * Generate instructions for the structuring agent based on the schema
   */
  private generateInstructions(): string {
    return `You are a data structuring specialist. Your job is to convert unstructured text into a specific JSON format.

TASK: Convert the provided unstructured text into valid JSON that matches the following schema:

REQUIREMENTS:
- Return ONLY valid JSON, no additional text or explanation
- Extract relevant information from the input text
- If information is missing, use reasonable defaults or null values
- Maintain data types as specified in the schema
- Be consistent and accurate in your conversions

The input text may be in any format (sentences, bullet points, paragraphs, etc.). Extract the relevant data and structure it according to the schema.`;
  }

  /**
   * Handle errors based on the configured strategy
   */
  private handleError(context: string, error: unknown, abort: (reason?: string) => never): void {
    const errorMessage = this.getErrorMessage(error);
    const message = `[StructuredOutputProcessor] ${context}: ${errorMessage}`;

    switch (this.errorStrategy) {
      case 'strict':
        this.logger?.error(message, error);
        abort(message);
        break;
      case 'warn':
        this.logger?.warn(message, error);
        break;
      case 'fallback':
        this.logger?.info(`${message} (using fallback)`, error);
        break;
    }
  }

  private getErrorMessage(error: unknown): string {
    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }
}
