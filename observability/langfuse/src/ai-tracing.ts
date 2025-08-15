/**
 * Langfuse Exporter for Mastra AI Tracing
 *
 * This exporter sends tracing data to Langfuse for AI observability.
 * Root spans start traces in Langfuse.
 * LLM_GENERATION spans become Langfuse generations, all others become spans.
 */

import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient } from 'langfuse';
import type { AITracingExporter, AITracingEvent, AnyAISpan, LLMGenerationAttributes } from '@mastra/core/ai-tracing';
import { AISpanType } from '@mastra/core/ai-tracing';

export interface LangfuseExporterConfig {
  /** Langfuse API key */
  publicKey: string;
  /** Langfuse secret key */
  secretKey: string;
  /** Langfuse host URL */
  baseUrl: string;
  /** Enable realtime mode - flushes after each event for immediate visibility */
  realtime?: boolean;
  /** Additional options to pass to the Langfuse client */
  options?: any;
}

export class LangfuseExporter implements AITracingExporter {
  name = 'langfuse';
  private client: Langfuse;
  private realtime: boolean;
  private traceMap = new Map<
    string,
    {
      trace: LangfuseTraceClient; // Langfuse trace object
      spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>; // Maps span.id to Langfuse span/generation
    }
  >();

  constructor(config: LangfuseExporterConfig) {
    this.realtime = config.realtime ?? false;
    this.client = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      ...config.options,
    });
  }

  async exportEvent(event: AITracingEvent): Promise<void> {
    switch (event.type) {
      case 'span_started':
        await this.handleSpanStarted(event.span);
        break;
      case 'span_updated':
        await this.handleSpanUpdated(event.span);
        break;
      case 'span_ended':
        await this.handleSpanEnded(event.span);
        break;
    }

    // Flush immediately in realtime mode for instant visibility
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  private async handleSpanStarted(span: AnyAISpan): Promise<void> {
    if (span.isRootSpan) {
      const trace = this.client.trace({
        id: span.trace.id,
        name: span.name,
        userId: span.metadata?.userId,
        sessionId: span.metadata?.sessionId,
        input: span.input,
        metadata: {
          ...this.sanitizeMetadata(span.attributes),
          ...this.sanitizeMetadata(span.metadata),
        },
      });
      this.traceMap.set(span.trace.id, {
        trace,
        spans: new Map(),
      });
    }

    // Create appropriate Langfuse object based on span type
    if (span.type === AISpanType.LLM_GENERATION) {
      await this.createLangfuseGeneration(span);
    } else {
      await this.createLangfuseSpan(span);
    }
  }

  private async handleSpanUpdated(span: AnyAISpan): Promise<void> {
    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) return;

    const langfuseObject = traceData.spans.get(span.id);
    if (!langfuseObject) return;

    if (span.type === AISpanType.LLM_GENERATION) {
      const attributes = span.attributes ? (span.attributes as LLMGenerationAttributes) : undefined;
      if (attributes) {
        const { usage, model, ...otherAttributes } = attributes;
        langfuseObject.update({
          input: span.input,
          output: span.output,
          usage: usage,
          model: model,
          metadata: {
            ...this.sanitizeMetadata(otherAttributes),
            ...this.sanitizeMetadata(span.metadata),
          },
        });
      } else {
        langfuseObject.update({
          input: span.input,
          output: span.output,
          metadata: {
            ...this.sanitizeMetadata(span.metadata),
          },
        });
      }
    } else {
      langfuseObject.update({
        input: span.input,
        output: span.output,
        metadata: {
          ...this.sanitizeMetadata(span.attributes),
          ...this.sanitizeMetadata(span.metadata),
        },
      });
    }
  }

  private async handleSpanEnded(span: AnyAISpan): Promise<void> {
    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) return;

    const langfuseObject = traceData.spans.get(span.id);
    if (!langfuseObject) return;

    if (span.type === AISpanType.LLM_GENERATION) {
      const attributes = span.attributes ? (span.attributes as LLMGenerationAttributes) : undefined;
      if (attributes) {
        const { usage, model, ...otherAttributes } = attributes;
        langfuseObject.end({
          output: span.output,
          usage: usage,
          model: model,
          metadata: {
            ...this.sanitizeMetadata(otherAttributes),
            ...this.sanitizeMetadata(span.metadata),
          },
        });
      } else {
        langfuseObject.end({
          output: span.output,
          metadata: {
            ...this.sanitizeMetadata(span.metadata),
          },
        });
      }
    } else {
      langfuseObject.end({
        output: span.output,
        metadata: {
          ...this.sanitizeMetadata(span.attributes),
          ...this.sanitizeMetadata(span.metadata),
        },
      });
    }

    // Add error information if present
    if (span.errorInfo) {
      langfuseObject.update({
        level: 'ERROR',
        statusMessage: span.errorInfo.message,
      });
    }

    if (span.isRootSpan) {
      traceData.trace.update({ output: span.output });
      this.traceMap.delete(span.trace.id);
    }
  }

  private async createLangfuseGeneration(span: AnyAISpan): Promise<void> {
    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) return;

    const parent =
      span.parent && traceData.spans.has(span.parent.id) ? traceData.spans.get(span.parent.id)! : traceData.trace;

    const attributes = span.attributes ? (span.attributes as LLMGenerationAttributes) : undefined;

    let generation: LangfuseGenerationClient;

    if (attributes) {
      const { model, parameters, usage, ...otherAttributes } = attributes;

      generation = parent.generation({
        id: span.id,
        name: span.name,
        model,
        modelParameters: parameters,
        input: span.input,
        output: span.output,
        usage,
        metadata: {
          ...this.sanitizeMetadata(otherAttributes),
          ...this.sanitizeMetadata(span.metadata),
        },
      });
    } else {
      generation = parent.generation({
        id: span.id,
        name: span.name,
        input: span.input,
        output: span.output,
        metadata: {
          ...this.sanitizeMetadata(span.metadata),
        },
      });
    }

    traceData.spans.set(span.id, generation);
  }

  private async createLangfuseSpan(span: AnyAISpan): Promise<void> {
    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) return;

    const parent =
      span.parent && traceData.spans.has(span.parent.id) ? traceData.spans.get(span.parent.id)! : traceData.trace;

    const langfuseSpan = parent.span({
      id: span.id,
      name: span.name,
      input: span.input,
      output: span.output,
      metadata: {
        spanType: span.type,
        ...this.sanitizeMetadata(span.attributes),
        ...this.sanitizeMetadata(span.metadata),
      },
    });

    traceData.spans.set(span.id, langfuseSpan);
  }

  private sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> {
    if (!metadata) return {};

    // Remove sensitive fields and ensure values are serializable
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (this.isSerializable(value)) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private isSerializable(value: any): boolean {
    try {
      JSON.stringify(value);
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
    this.traceMap.clear();
  }
}
