import type z from 'zod';
import { Agent } from '../../agent';
import type { MastraMessageV2 } from '../../agent/message-list';
import type { StructuredOutputOptions } from '../../agent/types';
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
export class StructuredOutputProcessor<S extends z.ZodTypeAny> implements Processor {
  readonly name = 'structured-output';

  public schema: S;
  private structuringAgent: Agent;
  private errorStrategy: 'strict' | 'warn' | 'fallback';
  private fallbackValue?: z.infer<S>;

  constructor(options: StructuredOutputOptions<S>) {
    this.schema = options.schema;
    this.errorStrategy = options.errorStrategy ?? 'strict';
    this.fallbackValue = options.fallbackValue;

    // Create internal structuring agent
    this.structuringAgent = new Agent({
      name: 'structured-output-structurer',
      instructions: options.instructions || this.generateInstructions(),
      model: options.model,
    });
  }

  async processOutputResult(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> {
    const { messages, abort } = args;

    // Process the final assistant message
    const processedMessages = await Promise.all(
      messages.map(async message => {
        if (message.role !== 'assistant') {
          return message;
        }

        // Extract text content from the message
        const textContent = this.extractTextContent(message);
        if (!textContent.trim()) {
          return message;
        }

        try {
          const modelDef = await this.structuringAgent.getModel();
          let structuredResult;
          const prompt = `Extract and structure the key information from the following text according to the specified schema. Keep the original meaning and details:\n\n${textContent}`;
          const schema = this.schema;

          // Use structuring agent to extract structured data from the unstructured text
          if (modelDef.specificationVersion === 'v2') {
            structuredResult = await this.structuringAgent.generateVNext(prompt, {
              output: schema,
            });
          } else {
            structuredResult = await this.structuringAgent.generate(prompt, {
              output: schema,
            });
          }

          if (!structuredResult.object) {
            this.handleError('Structuring failed', 'Internal agent did not generate structured output', abort);

            if (this.errorStrategy === 'fallback' && this.fallbackValue !== undefined) {
              // For fallback, return original message with fallback data in content.metadata
              return {
                ...message,
                content: {
                  ...message.content,
                  metadata: {
                    ...(message.content.metadata || {}),
                    structuredOutput: this.fallbackValue,
                  },
                },
              };
            }

            return message;
          }

          // Store both original text and structured data in a way the agent can use
          // The agent expects text but we need both text and object for experimental_output
          return {
            ...message,
            content: {
              ...message.content,
              parts: [
                {
                  type: 'text' as const,
                  text: textContent, // Keep original text unchanged
                },
              ],
              metadata: {
                ...(message.content.metadata || {}),
                structuredOutput: structuredResult.object,
              },
            },
          };
        } catch (error) {
          this.handleError('Processing failed', error instanceof Error ? error.message : 'Unknown error', abort);

          if (this.errorStrategy === 'fallback' && this.fallbackValue !== undefined) {
            // For fallback, return original message with fallback data in content.metadata
            return {
              ...message,
              content: {
                ...message.content,
                metadata: {
                  ...(message.content.metadata || {}),
                  structuredOutput: this.fallbackValue,
                },
              },
            };
          }

          return message;
        }
      }),
    );

    return processedMessages;
  }

  /**
   * Extract text content from a message
   */
  private extractTextContent(message: MastraMessageV2): string {
    let text = '';

    if (message.content.parts) {
      for (const part of message.content.parts) {
        if (part.type === 'text' && 'text' in part && typeof part.text === 'string') {
          text += part.text + ' ';
        }
      }
    }

    if (!text.trim() && typeof message.content.content === 'string') {
      text = message.content.content;
    }

    return text.trim();
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

    console.error(`ERROR from StructuredOutputProcessor: ${message}`);

    switch (this.errorStrategy) {
      case 'strict':
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
