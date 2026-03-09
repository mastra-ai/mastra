import type { TransformStreamDefaultController } from 'node:stream/web';
import { Agent } from '../../agent';
import type { StructuredOutputOptions } from '../../agent/types';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { ProviderOptions } from '../../llm/model/provider-options';
import type { IMastraLogger } from '../../logger';
import type { ObservabilityContext } from '../../observability';
import { resolveObservabilityContext } from '../../observability';
import { ChunkFrom } from '../../stream';
import type { ChunkType, OutputSchema } from '../../stream';
import type { ToolCallChunk, ToolResultChunk } from '../../stream/types';
import type { Processor } from '../index';

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

  public schema: NonNullable<OutputSchema<OUTPUT>>;
  private structuringAgent: Agent<any, any, undefined>;
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
    this.errorStrategy = options.errorStrategy ?? 'strict';
    this.fallbackValue = options.fallbackValue;
    this.jsonPromptInjection = options.jsonPromptInjection;
    this.providerOptions = options.providerOptions;
    this.logger = options.logger;
    // Create internal structuring agent
    this.structuringAgent = new Agent({
      id: 'structured-output-structurer',
      name: 'structured-output-structurer',
      instructions: options.instructions || this.generateInstructions(),
      model: options.model,
    });
  }

  async processOutputStream(
    args: {
      part: ChunkType;
      streamParts: ChunkType[];
      state: Record<string, unknown> & {
        controller?: TransformStreamDefaultController<ChunkType<OUTPUT>>;
      };
      abort: (reason?: string, options?: unknown) => never;
      retryCount: number;
    } & Partial<ObservabilityContext>,
  ): Promise<ChunkType | null | undefined> {
    const { part, state, streamParts, abort, ...rest } = args;
    const observabilityContext = resolveObservabilityContext(rest);
    const controller = state.controller as TransformStreamDefaultController<ChunkType<OUTPUT>>;

    switch (part.type) {
      case 'finish':
        // The main stream is finished, intercept it and start the structuring agent stream
        // - enqueue the structuring agent stream chunks into the main stream
        // - when the structuring agent stream is finished, enqueue the final chunk into the main stream

        await this.processAndEmitStructuredOutput(streamParts, controller, abort, observabilityContext);
        return part;

      default:
        return part;
    }
  }

  private async processAndEmitStructuredOutput(
    streamParts: ChunkType[],
    controller: TransformStreamDefaultController<ChunkType<OUTPUT>>,
    abort: (reason?: string) => never,
    observabilityContext?: ObservabilityContext,
  ): Promise<void> {
    if (this.isStructuringAgentStreamStarted) return;
    this.isStructuringAgentStreamStarted = true;
    try {
      const structuringPrompt = this.buildStructuringPrompt(streamParts);
      const prompt = `Extract and structure the key information from the following text according to the specified schema. Keep the original meaning and details:\n\n${structuringPrompt}`;

      // Use structuredOutput in 'direct' mode (no model) since this agent already has a model
      const structuringAgentStream = await this.structuringAgent.stream(prompt, {
        structuredOutput: {
          schema: this.schema!,
          jsonPromptInjection: this.jsonPromptInjection,
        },
        providerOptions: this.providerOptions,
        ...observabilityContext,
      });

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
          this.handleError('Structuring failed', 'Internal agent did not generate structured output', abort);

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
            controller.enqueue(fallbackChunk);
            break;
          }
        }

        const newChunk: ChunkType<OUTPUT> = {
          ...chunk,
          metadata: {
            from: 'structured-output',
          },
        } as const;
        controller.enqueue(newChunk);
      }
    } catch (error) {
      this.handleError(
        'Structured output processing failed',
        error instanceof Error ? error.message : 'Unknown error',
        abort,
      );
    }
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
  private handleError(context: string, error: string, abort: (reason?: string) => never): void {
    const message = `[StructuredOutputProcessor] ${context}: ${error}`;

    switch (this.errorStrategy) {
      case 'strict':
        this.logger?.error(message);
        abort(message);
        break;
      case 'warn':
        this.logger?.warn(message);
        break;
      case 'fallback':
        this.logger?.info(`${message} (using fallback)`);
        break;
    }
  }
}
