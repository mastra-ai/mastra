import type z from 'zod';
import { Agent } from '../../agent';
import type { StructuredOutputOptions } from '../../agent/types';
import type { MastraLanguageModel } from '../../llm/model/shared.types';
import type { OutputSchema } from '../../stream';
import type { InferSchemaOutput } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import type { Processor } from '../index';

export type { StructuredOutputOptions } from '../../agent/types';

/**
 * StructuredOutputProcessor transforms unstructured agent output into structured JSON
 * using an internal structuring agent and provides real-time streaming support.
 *
 * Features:
 * - Real-time stream processing: merges structured output chunks into main stream
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

  private accumulatedText = '';
  private isStreamStarted = false;

  async processOutputStream(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    controller?: any; // TransformStreamDefaultController
    abort: (reason?: string) => never;
  }): Promise<ChunkType | null | undefined> {
    const { part, controller } = args;

    console.log(part.type);

    if (['text-end', 'step-start', 'step-finish', 'finish', 'error', 'abort'].includes(part.type)) {
      console.log(part);
    }

    switch (part.type) {
      case 'text-delta':
        // Accumulate text but don't start processing yet
        this.accumulatedText += part.payload.text;
        return part;

      case 'finish':
        // Start structured output processing only after main agent finishes
        if (controller && !this.isStreamStarted && this.accumulatedText.trim().length > 0) {
          await this.processAndEmitStructuredOutput(part.runId, part.from, controller);
        }
        return part;
    }

    return part;
  }

  private async processAndEmitStructuredOutput(runId: string, from: any, controller: any) {
    if (this.isStreamStarted) return;

    this.isStreamStarted = true;

    console.log('starting processAndEmitStructuredOutput running streamVNext internal agent stream');
    try {
      // Use current accumulated text at the time of starting
      const textToProcess = this.accumulatedText;
      const prompt = `Extract and structure the key information from the following text according to the specified schema. Keep the original meaning and details:\n\n${textToProcess}`;

      const modelDef = await this.structuringAgent.getModel();

      if (modelDef.specificationVersion === 'v2') {
        const outputStream = await this.structuringAgent.streamVNext(prompt, {
          output: this.schema,
        });

        // Stream object chunks directly into the main stream
        for await (const chunk of outputStream.fullStream) {
          console.log('inner stream chunk:', chunk.type);
          controller.enqueue(chunk);

          // Create structured output chunk that merges into main stream
          // const objectChunk: ChunkType = {
          //   type: 'object',
          //   runId,
          //   from,
          //   object: structuredChunk as any,
          // };
          // console.log('emitting object chunk to the main stream from internal agent stream', objectChunk);

          // controller.enqueue(objectChunk);
        }

        // // Get final structured result and emit it
        // const finalResult = await outputStream.object;
        // if (finalResult) {
        //   // Create final object chunk with complete result
        //   const finalObjectChunk: ChunkType = {
        //     type: 'object',
        //     runId,
        //     from,
        //     object: finalResult as any,
        //   };
        //   controller.enqueue(finalObjectChunk);
        // }
      } else {
        throw new Error('model v1 not supported');
        // // Fallback for v1 models - generate once at the end
        // const result = await this.structuringAgent.generate(prompt, {
        //   output: this.schema,
        // });

        // if (result?.object) {
        //   const objectChunk: ChunkType = {
        //     type: 'object',
        //     runId,
        //     from,
        //     object: result.object as any,
        //   };

        //   controller.enqueue(objectChunk);
        // }
      }
    } catch (error) {
      this.handleError('Structured output processing failed', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private handleError(context: string, error: string): void {
    const message = `[StructuredOutputProcessor] ${context}: ${error}`;

    console.error(`ERROR from StructuredOutputProcessor: ${message}`);

    switch (this.errorStrategy) {
      case 'strict':
        throw new Error(message);
      case 'warn':
        console.warn(message);
        break;
      case 'fallback':
        console.info(`${message} (using fallback)`);
        if (this.fallbackValue !== undefined) {
          // TODO: Emit fallback value as object chunk
        }
        break;
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
}
