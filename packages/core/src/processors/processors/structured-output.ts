import type { TransformStreamDefaultController } from 'stream/web';
import type { ZodTypeAny } from 'zod';
import { Agent } from '../../agent';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { StructuredOutputOptions } from '../../agent/types';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import { ChunkFrom } from '../../stream';
import type { ChunkType, OutputSchema } from '../../stream';
import type { InferSchemaOutput } from '../../stream/base/schema';
import type { Processor } from '../index';

export type { StructuredOutputOptions } from '../../agent/types';

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
export class StructuredOutputProcessor<OUTPUT extends OutputSchema> implements Processor {
  readonly name = 'structured-output';

  public schema: OUTPUT;
  private structuringAgent: Agent;
  private errorStrategy: 'strict' | 'warn' | 'fallback';
  private fallbackValue?: InferSchemaOutput<OUTPUT>;
  private isStructuringAgentStreamStarted = false;

  constructor(options: StructuredOutputOptions<OUTPUT>, fallbackModel?: MastraLanguageModel) {
    this.schema = options.schema;
    this.errorStrategy = options.errorStrategy ?? 'strict';
    this.fallbackValue = options.fallbackValue;

    // Use provided model or fallback model
    const modelToUse = options.model || fallbackModel;
    if (!modelToUse) {
      throw new Error('StructuredOutputProcessor requires a model to be provided either in options or as fallback');
    }

    // Create internal structuring agent
    this.structuringAgent = new Agent({
      name: 'structured-output-structurer',
      instructions: options.instructions || this.generateInstructions(),
      model: modelToUse,
    });
  }

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: {
      controller: TransformStreamDefaultController<ChunkType<OUTPUT>>;
    };
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null | undefined> {
    const { part, state, streamParts, abort } = args;
    const controller = state.controller;

    switch (part.type) {
      case 'finish':
        // The main stream is finished, intercept it and start the structuring agent stream
        // - enqueue the structuring agent stream chunks into the main stream
        // - when the structuring agent stream is finished, enqueue the final chunk into the main stream

        await this.processAndEmitStructuredOutput(streamParts, controller, abort);
        return part;

      default:
        return part;
    }
  }

  private async processAndEmitStructuredOutput(
    streamParts: ChunkType[],
    controller: TransformStreamDefaultController<ChunkType<OUTPUT>>,
    abort: (reason?: string) => never,
  ): Promise<void> {
    if (this.isStructuringAgentStreamStarted) return;
    this.isStructuringAgentStreamStarted = true;

    try {
      const structuringPrompt = this.buildStructuringPrompt(streamParts);
      const prompt = `Extract and structure the key information from the following text according to the specified schema. Keep the original meaning and details:\n\n${structuringPrompt}`;

      const structuringAgentStream = await this.structuringAgent.streamVNext(prompt, {
        output: this.schema,
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
        if (excludedChunkTypes.includes(chunk.type)) {
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

        const newChunk = {
          ...chunk,
          metadata: {
            from: 'structured-output',
          },
        };
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
   * Groups consecutive chunks by type and source to create readable sections
   */
  private buildStructuringPrompt(streamParts: ChunkType[]): string {
    const sections: { heading: string; content: string[] }[] = [];
    let currentSection: { heading: string; content: string[] } | null = null;

    for (const part of streamParts) {
      switch (part.type) {
        case 'text-delta':
          const textHeading = this.getHeadingForTextChunk(part.from);

          // Continue current section if same heading, otherwise start new one
          if (currentSection && currentSection.heading === textHeading) {
            currentSection.content.push(part.payload.text);
          } else {
            // Start new text section
            if (currentSection) {
              sections.push(currentSection);
            }
            currentSection = {
              heading: textHeading,
              content: [part.payload.text],
            };
          }
          break;

        case 'reasoning-delta':
          const reasoningHeading = '# Assistant thought';

          if (currentSection && currentSection.heading === reasoningHeading) {
            currentSection.content.push(part.payload.text);
          } else {
            if (currentSection) {
              sections.push(currentSection);
            }
            currentSection = {
              heading: reasoningHeading,
              content: [part.payload.text],
            };
          }
          break;

        case 'tool-call':
          // Finish current section and add tool call
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }

          const toolName = part.payload.toolName || 'Unknown Tool';
          const toolArgs = part.payload.args ? JSON.stringify(part.payload.args, null, 2) : '{}';
          const toolOutput = part.payload.output !== undefined ? part.payload.output : null;

          const content = [`Input:\n\`\`\`json\n${toolArgs}\n\`\`\``];
          if (toolOutput !== null) {
            const outputType = typeof toolOutput;
            if (outputType === 'string' || outputType === 'number' || outputType === 'boolean') {
              content.push(`\nOutput: ${String(toolOutput)}`);
            } else {
              content.push(`\nOutput:\n\`\`\`json\n${JSON.stringify(toolOutput, null, 2)}\n\`\`\``);
            }
          }

          sections.push({
            heading: `# Tool Call: ${toolName}`,
            content,
          });
          break;

        case 'tool-result':
          // Finish current section and add tool result
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }

          const result = part.payload.result;
          let resultContent: string;

          if (result === undefined || result === null) {
            resultContent = 'Output: null';
          } else {
            const resultType = typeof result;
            if (resultType === 'string' || resultType === 'number' || resultType === 'boolean') {
              resultContent = `Output: ${String(result)}`;
            } else {
              resultContent = `Output:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
            }
          }

          sections.push({
            heading: '# Tool Result',
            content: [resultContent],
          });
          break;

        case 'source':
          // Finish current section and add source
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }

          const source = part.payload;
          sections.push({
            heading: '# Source',
            content: [
              `Title: ${source.title || 'N/A'}\nURL: ${source.url || 'N/A'}\nType: ${source.sourceType}\nFilename: ${source.filename || 'N/A'}`,
            ],
          });
          break;

        case 'file':
          // Finish current section and add file
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }

          const file = part.payload;
          sections.push({
            heading: '# File',
            content: [
              `Type: ${file.mimeType || 'unknown'}\nData: ${typeof file.data === 'string' ? file.data.substring(0, 100) + '...' : '[Binary Data]'}`,
            ],
          });
          break;

        // Skip metadata and control chunks
        case 'response-metadata':
        case 'text-start':
        case 'text-end':
        case 'reasoning-start':
        case 'reasoning-end':
        case 'reasoning-signature':
        case 'redacted-reasoning':
        case 'tool-call-input-streaming-start':
        case 'tool-call-delta':
        case 'tool-call-input-streaming-end':
        case 'tool-error':
        case 'tool-output':
        case 'step-start':
        case 'step-finish':
        case 'step-output':
        case 'workflow-step-output':
        case 'start':
        case 'finish':
        case 'error':
        case 'abort':
        case 'raw':
        case 'watch':
        case 'tripwire':
        case 'object':
          // These are control chunks or handled elsewhere, skip them
          break;

        default:
          // For any other chunk types, close current section if needed
          if (currentSection) {
            sections.push(currentSection);
            currentSection = null;
          }
          break;
      }
    }

    // Add any remaining section
    if (currentSection) {
      sections.push(currentSection);
    }

    // Format the final output - group sections with same heading
    const formattedSections: string[] = [];
    let lastHeading = '';

    for (const section of sections) {
      if (section.heading !== lastHeading) {
        formattedSections.push(section.heading);
        lastHeading = section.heading;
      }
      formattedSections.push(section.content.join(''));
    }

    return formattedSections.join('\n\n');
  }

  /**
   * Get the appropriate heading for text chunks based on the 'from' field
   */
  private getHeadingForTextChunk(from: ChunkFrom): string {
    switch (from) {
      case ChunkFrom.AGENT:
        return '# Assistant said';
      case ChunkFrom.USER:
        return '# User said';
      case ChunkFrom.SYSTEM:
        return '# System message';
      case ChunkFrom.WORKFLOW:
        return '# Text from Workflow';
      default:
        return `# ${String(from)}`;
    }
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
        console.error(message);
        abort(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'fallback':
        console.info(`${message} (using fallback)`);
        break;
    }
  }
}
