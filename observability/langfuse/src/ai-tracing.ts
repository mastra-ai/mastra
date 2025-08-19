/**
 * Langfuse Exporter for Mastra AI Tracing
 *
 * This exporter sends tracing data to Langfuse for AI observability.
 * Root spans start traces in Langfuse.
 * LLM_GENERATION spans become Langfuse generations, all others become spans.
 */

import type { AITracingExporter, AITracingEvent, AnyAISpan, LLMGenerationAttributes } from '@mastra/core/ai-tracing';
import { AISpanType, sanitizeMetadata, omitKeys } from '@mastra/core/ai-tracing';
import { Langfuse } from 'langfuse';
import type { LangfuseTraceClient, LangfuseSpanClient, LangfuseGenerationClient } from 'langfuse';

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

type TraceData = {
  trace: LangfuseTraceClient; // Langfuse trace object
  spans: Map<string, LangfuseSpanClient | LangfuseGenerationClient>; // Maps span.id to Langfuse span/generation
};

type LangfuseSpan = LangfuseTraceClient | LangfuseSpanClient | LangfuseGenerationClient;

export class LangfuseExporter implements AITracingExporter {
  name = 'langfuse';
  private client: Langfuse;
  private realtime: boolean;
  private traceMap = new Map<string, TraceData>();

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
        await this.handleSpanUpdateOrEnd(event.span, true);
        break;
      case 'span_ended':
        await this.handleSpanUpdateOrEnd(event.span, false);
        break;
    }

    // Flush immediately in realtime mode for instant visibility
    if (this.realtime) {
      await this.client.flushAsync();
    }
  }

  private async handleSpanStarted(span: AnyAISpan): Promise<void> {
    if (span.isRootSpan) {
      const trace = this.client.trace(this.buildTracePayload(span));
      this.traceMap.set(span.trace.id, { trace, spans: new Map() });
    }

    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) {
      console.log('NO TRACE');
      // TODO: log warning
      return;
    }

    const langfuseParent =
      span.parent && traceData.spans.has(span.parent.id)
        ? (traceData.spans.get(span.parent.id) as LangfuseSpan)
        : traceData.trace;

    const payload = this.buildSpanPayload(span, true);

    const langfuseSpan =
      span.type === AISpanType.LLM_GENERATION ? langfuseParent.generation(payload) : langfuseParent.span(payload);

    traceData.spans.set(span.id, langfuseSpan);
  }

  private async handleSpanUpdateOrEnd(span: AnyAISpan, isUpdate: boolean): Promise<void> {
    const traceData = this.traceMap.get(span.trace.id);
    if (!traceData) {
      console.log('NO TRACE');
      // TODO: log warning
      return;
    }

    const langfuseSpan = traceData.spans.get(span.id);
    if (!langfuseSpan) {
      console.log('NO SPAN');
      // TODO: log warning
      return;
    }

    if (isUpdate) {
      langfuseSpan.update(this.buildSpanPayload(span, false));
    } else {
      langfuseSpan.end(this.buildSpanPayload(span, false));

      if (span.isRootSpan) {
        traceData.trace.update({ output: span.output });
        this.traceMap.delete(span.trace.id);
      }
    }
  }

  private buildTracePayload(span: AnyAISpan): Record<string, any> {
    const payload: Record<string, any> = {
      id: span.trace.id,
      name: span.name,
    };

    const { userId, sessionId, ...remainingMetadata } = span.metadata ?? {};

    if (userId) payload.userId = userId;
    if (sessionId) payload.sessionId = sessionId;
    if (span.input) payload.input = span.input;

    payload.metadata = {
      spanType: span.type,
      ...sanitizeMetadata(span.attributes),
      ...sanitizeMetadata(remainingMetadata),
    };

    return payload;
  }

  private buildSpanPayload(span: AnyAISpan, isCreate: boolean): Record<string, any> {
    const payload: Record<string, any> = {};

    if (isCreate) {
      payload.id = span.id;
      payload.name = span.name;
      payload.startTime = span.startTime;
      if (span.input !== undefined) payload.input = span.input;
    }

    if (span.output !== undefined) payload.output = span.output;
    if (span.endTime !== undefined) payload.endTime = span.endTime;

    const attributes = (span.attributes ?? {}) as Record<string, any>;

    // Strip special fields from metadata if used in top-level keys
    const attributesToOmit: string[] = [];

    if (span.type === AISpanType.LLM_GENERATION) {
      const llmAttr = attributes as LLMGenerationAttributes;

      if (llmAttr.model !== undefined) {
        payload.model = llmAttr.model;
        attributesToOmit.push('model');
      }

      if (llmAttr.usage !== undefined) {
        payload.usage = llmAttr.usage;
        attributesToOmit.push('usage');
      }

      if (llmAttr.parameters !== undefined) {
        payload.modelParameters = llmAttr.parameters;
        attributesToOmit.push('parameters');
      }
    }

    payload.metadata = {
      spanType: span.type,
      ...sanitizeMetadata(omitKeys(attributes, attributesToOmit)),
      ...sanitizeMetadata(span.metadata),
    };

    if (span.errorInfo) {
      payload.level = 'ERROR';
      payload.statusMessage = span.errorInfo.message;
    }

    return payload;
  }

  async shutdown(): Promise<void> {
    await this.client.shutdownAsync();
    this.traceMap.clear();
  }
}
