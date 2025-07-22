/**
 * Langfuse Exporter for Mastra AI Telemetry
 *
 * This exporter sends telemetry data to Langfuse for AI observability.
 * Root spans in our system start traces in Langfuse.
 * LLM_GENERATION spans become Langfuse generations, all others become spans.
 */

import { Langfuse } from 'langfuse';
import type { TelemetryExporter, TelemetryEvent, AISpan, LLMGenerationMetadata } from '../types';
import { SpanType } from '../types';

export interface LangfuseExporterConfig {
  /** Langfuse API key */
  publicKey: string;
  /** Langfuse secret key */
  secretKey: string;
  /** Langfuse host URL (defaults to cloud) */
  baseUrl?: string;
  /** Additional options for Langfuse client */
  options?: {
    debug?: boolean;
    flushAt?: number;
    flushInterval?: number;
    requestTimeout?: number;
  };
}

export class LangfuseExporter implements TelemetryExporter {
  name = 'langfuse';
  private client: Langfuse;
  private traceMap = new Map<string, any>(); // Maps span.trace.id to Langfuse trace
  private spanMap = new Map<string, any>(); // Maps span.id to Langfuse span/generation

  constructor(config: LangfuseExporterConfig) {
    this.client = new Langfuse({
      publicKey: config.publicKey,
      secretKey: config.secretKey,
      baseUrl: config.baseUrl,
      ...config.options,
    });
  }

  async exportEvent(event: TelemetryEvent): Promise<void> {
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
  }

  private async handleSpanStarted(span: AISpan): Promise<void> {
    // If this is a root span, create a new trace
    if (!span.parent) {
      const trace = this.client.trace({
        id: span.trace.id,
        name: span.name,
        userId: span.metadata.attributes?.userId,
        sessionId: span.metadata.attributes?.sessionId,
        tags: span.metadata.tags,
        metadata: this.sanitizeMetadata(span.metadata.attributes),
      });
      this.traceMap.set(span.trace.id, trace);
    }

    // Create appropriate Langfuse object based on span type
    if (span.type === SpanType.LLM_GENERATION) {
      await this.createLangfuseGeneration(span);
    } else {
      await this.createLangfuseSpan(span);
    }
  }

  private async handleSpanUpdated(span: AISpan): Promise<void> {
    const langfuseObject = this.spanMap.get(span.id);
    if (!langfuseObject) return;

    // Update the Langfuse object with new metadata
    const updateData = this.buildUpdateData(span);
    langfuseObject.update(updateData);
  }

  private async handleSpanEnded(span: AISpan): Promise<void> {
    const langfuseObject = this.spanMap.get(span.id);
    if (!langfuseObject) return;

    // End the Langfuse object
    const endData = this.buildEndData(span);
    langfuseObject.end(endData);

    // Clean up references
    this.spanMap.delete(span.id);

    // If this was a root span, clean up the trace reference
    if (!span.parent) {
      this.traceMap.delete(span.trace.id);
    }
  }

  private async createLangfuseGeneration(span: AISpan): Promise<void> {
    const trace = this.traceMap.get(span.trace.id);
    if (!trace) return;

    const metadata = span.metadata as LLMGenerationMetadata;
    const parent = span.parent ? this.spanMap.get(span.parent.id) : trace;

    const generation = parent.generation({
      id: span.id,
      name: span.name,
      model: metadata.model,
      modelParameters: metadata.parameters
        ? {
            temperature: metadata.parameters.temperature,
            maxTokens: metadata.parameters.maxTokens,
            topP: metadata.parameters.topP,
            frequencyPenalty: metadata.parameters.frequencyPenalty,
            presencePenalty: metadata.parameters.presencePenalty,
            stop: metadata.parameters.stop,
          }
        : undefined,
      input: metadata.input,
      output: metadata.output,
      usage: metadata.usage
        ? {
            promptTokens: metadata.usage.promptTokens,
            completionTokens: metadata.usage.completionTokens,
            totalTokens: metadata.usage.totalTokens,
          }
        : undefined,
      metadata: {
        provider: metadata.provider,
        resultType: metadata.resultType,
        streaming: metadata.streaming,
        timeToFirstToken: metadata.timeToFirstToken,
        tokensPerSecond: metadata.tokensPerSecond,
        confidence: metadata.confidence,
        ...this.sanitizeMetadata(metadata.attributes),
      },
      tags: metadata.tags,
    });

    this.spanMap.set(span.id, generation);
  }

  private async createLangfuseSpan(span: AISpan): Promise<void> {
    const trace = this.traceMap.get(span.trace.id);
    if (!trace) return;

    const parent = span.parent ? this.spanMap.get(span.parent.id) : trace;

    const langfuseSpan = parent.span({
      id: span.id,
      name: span.name,
      input: this.extractSpanInput(span),
      output: this.extractSpanOutput(span),
      metadata: {
        spanType: span.type,
        ...this.sanitizeMetadata(span.metadata.attributes),
        ...this.extractTypeSpecificMetadata(span),
      },
      tags: span.metadata.tags,
    });

    this.spanMap.set(span.id, langfuseSpan);
  }

  private buildUpdateData(span: AISpan): any {
    const baseData: any = {
      metadata: {
        spanType: span.type,
        ...this.sanitizeMetadata(span.metadata.attributes),
        ...this.extractTypeSpecificMetadata(span),
      },
      tags: span.metadata.tags,
    };

    // Add type-specific update data
    if (span.type === SpanType.LLM_GENERATION) {
      const metadata = span.metadata as LLMGenerationMetadata;
      return {
        ...baseData,
        input: metadata.input,
        output: metadata.output,
        usage: metadata.usage
          ? {
              promptTokens: metadata.usage.promptTokens,
              completionTokens: metadata.usage.completionTokens,
              totalTokens: metadata.usage.totalTokens,
            }
          : undefined,
      };
    }

    return {
      ...baseData,
      input: this.extractSpanInput(span),
      output: this.extractSpanOutput(span),
    };
  }

  private buildEndData(span: AISpan): any {
    const baseData = {
      endTime: span.endTime,
      metadata: {
        spanType: span.type,
        ...this.sanitizeMetadata(span.metadata.attributes),
        ...this.extractTypeSpecificMetadata(span),
      },
      tags: span.metadata.tags,
    };

    // Add error information if present
    if (span.metadata.error) {
      return {
        ...baseData,
        level: 'ERROR',
        statusMessage: span.metadata.error.message,
      };
    }

    return {
      ...baseData,
      level: 'DEFAULT',
    };
  }

  private extractSpanInput(span: AISpan): any {
    const metadata = span.metadata as any;

    // Extract input based on span type
    switch (span.type) {
      case SpanType.AGENT_RUN:
        return metadata.input;
      case SpanType.TOOL_CALL:
      case SpanType.MCP_TOOL_CALL:
        return metadata.input;
      case SpanType.MEMORY_LOOKUP:
        return { query: metadata.query, topK: metadata.topK };
      case SpanType.MEMORY_UPDATE:
        return { operation: metadata.operation, data: metadata.data };
      case SpanType.RAG_QUERY:
        return { query: metadata.query, topK: metadata.topK };
      case SpanType.EMBEDDING_GENERATION:
        return metadata.input;
      case SpanType.WORKFLOW_RUN:
        return metadata.input;
      case SpanType.WORKFLOW_STEP:
        return metadata.input;
      case SpanType.EVAL_EXECUTION:
        return { input: metadata.input, expected: metadata.expected };
      default:
        return metadata.input;
    }
  }

  private extractSpanOutput(span: AISpan): any {
    const metadata = span.metadata as any;

    // Extract output based on span type
    switch (span.type) {
      case SpanType.AGENT_RUN:
        return metadata.output;
      case SpanType.TOOL_CALL:
      case SpanType.MCP_TOOL_CALL:
        return metadata.output;
      case SpanType.MEMORY_LOOKUP:
        return metadata.results;
      case SpanType.MEMORY_UPDATE:
        return { success: metadata.success, itemCount: metadata.itemCount };
      case SpanType.RAG_QUERY:
        return metadata.chunks;
      case SpanType.EMBEDDING_GENERATION:
        return { dimensions: metadata.dimensions, inputCount: metadata.inputCount };
      case SpanType.WORKFLOW_RUN:
        return metadata.output;
      case SpanType.WORKFLOW_STEP:
        return metadata.output;
      case SpanType.EVAL_EXECUTION:
        return metadata.results;
      default:
        return metadata.output;
    }
  }

  private extractTypeSpecificMetadata(span: AISpan): Record<string, any> {
    const metadata = span.metadata as any;
    const result: Record<string, any> = {};

    // Add type-specific metadata
    switch (span.type) {
      case SpanType.AGENT_RUN:
        result.agentId = metadata.agentId;
        result.availableTools = metadata.availableTools;
        result.maxSteps = metadata.maxSteps;
        result.currentStep = metadata.currentStep;
        break;
      case SpanType.TOOL_CALL:
        result.toolId = metadata.toolId;
        result.toolType = metadata.toolType;
        result.success = metadata.success;
        break;
      case SpanType.MCP_TOOL_CALL:
        result.toolName = metadata.toolName;
        result.mcpServer = metadata.mcpServer;
        result.success = metadata.success;
        break;
      case SpanType.MEMORY_LOOKUP:
        result.memoryType = metadata.memoryType;
        result.threadId = metadata.threadId;
        result.threshold = metadata.threshold;
        break;
      case SpanType.MEMORY_UPDATE:
        result.memoryType = metadata.memoryType;
        result.operation = metadata.operation;
        result.storageBackend = metadata.storageBackend;
        break;
      case SpanType.RAG_QUERY:
        result.vectorStore = metadata.vectorStore;
        result.embeddingModel = metadata.embeddingModel;
        break;
      case SpanType.EMBEDDING_GENERATION:
        result.model = metadata.model;
        result.provider = metadata.provider;
        result.purpose = metadata.purpose;
        break;
      case SpanType.WORKFLOW_RUN:
        result.workflowId = metadata.workflowId;
        result.status = metadata.status;
        break;
      case SpanType.WORKFLOW_STEP:
        result.stepId = metadata.stepId;
        result.status = metadata.status;
        break;
      case SpanType.EVAL_EXECUTION:
        result.evalId = metadata.evalId;
        result.evalName = metadata.evalName;
        result.metrics = metadata.metrics;
        result.status = metadata.status;
        break;
    }

    return result;
  }

  private sanitizeMetadata(metadata: Record<string, any> | undefined): Record<string, any> {
    if (!metadata) return {};

    // Remove sensitive fields and ensure values are serializable
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (this.isSensitiveField(key)) continue;
      if (this.isSerializable(value)) {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private isSensitiveField(key: string): boolean {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey', 'authorization'];
    return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive));
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
    this.spanMap.clear();
  }
}
