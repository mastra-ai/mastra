import type { MastraStorage } from '@mastra/core/storage';
import type { SpanRecord, TraceRecord } from '@mastra/core/storage';
import type { AgentCase, AgentMessage, TracesDatasetConfig } from '../types';
import { BaseDatasetSource } from './dataset-source';

/**
 * Dataset source that reads from Mastra traces/observability storage.
 */
export class TracesSource extends BaseDatasetSource {
  private storage: MastraStorage;
  private config: TracesDatasetConfig['filter'];
  private agentName?: string;

  constructor(storage: MastraStorage, agentName?: string, config?: TracesDatasetConfig['filter']) {
    super();
    this.storage = storage;
    this.agentName = agentName;
    this.config = config;
  }

  async *streamCases(): AsyncIterable<AgentCase> {
    const observability = await this.storage.getStore('observability');
    if (!observability) {
      throw new Error('Observability storage is not available');
    }

    // Build filters for trace query
    const filters: Record<string, unknown> = {
      entityType: 'agent',
    };

    if (this.agentName || this.config?.agentName) {
      filters.entityName = this.agentName || this.config?.agentName;
    }

    if (this.config?.since || this.config?.until) {
      filters.startedAt = {
        ...(this.config?.since && { gte: this.config.since }),
        ...(this.config?.until && { lte: this.config.until }),
      };
    }

    if (this.config?.tags) {
      filters.tags = this.config.tags;
    }

    if (this.config?.metadata) {
      filters.metadata = this.config.metadata;
    }

    // Fetch traces with pagination
    let page = 0;
    const perPage = 100;
    let hasMore = true;

    while (hasMore) {
      const result = await observability.listTraces({
        filters: filters as any,
        pagination: { page, perPage },
        orderBy: { field: 'startedAt', direction: 'DESC' },
      });

      for (const rootSpan of result.spans) {
        // Get full trace with all spans
        const trace = await observability.getTrace({ traceId: rootSpan.traceId });
        if (!trace) continue;

        // Convert trace to AgentCase
        const agentCase = this.traceToAgentCase(trace, rootSpan);
        if (agentCase) {
          yield agentCase;
        }

        // Check limit
        if (this.config?.limit && page * perPage + result.spans.indexOf(rootSpan) >= this.config.limit) {
          return;
        }
      }

      hasMore = result.pagination.hasMore;
      page++;
    }
  }

  /**
   * Convert a trace to an AgentCase.
   */
  private traceToAgentCase(trace: TraceRecord, rootSpan: SpanRecord): AgentCase | null {
    const messages = this.extractMessages(trace, rootSpan);
    if (messages.length === 0) {
      return null;
    }

    return {
      id: trace.traceId,
      messages,
      metadata: {
        traceId: trace.traceId,
        spanId: rootSpan.spanId,
        entityName: rootSpan.entityName,
        timestamp: rootSpan.startedAt,
        ...(rootSpan.metadata as Record<string, unknown>),
      },
    };
  }

  /**
   * Extract messages from a trace.
   */
  private extractMessages(_trace: TraceRecord, rootSpan: SpanRecord): AgentMessage[] {
    const messages: AgentMessage[] = [];

    // Get input from the root span
    const input = rootSpan.input as any;
    if (input) {
      // Handle different input formats
      if (typeof input === 'string') {
        messages.push({ role: 'user', content: input });
      } else if (Array.isArray(input)) {
        // Array of messages (inputMessages format from scorer)
        for (const msg of input) {
          if (msg.role && msg.content) {
            messages.push({
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              toolCalls: msg.toolCalls,
              toolCallId: msg.toolCallId,
              name: msg.name,
            });
          }
        }
      } else if (input.inputMessages) {
        // ScorerRunInputForAgent format
        if (input.systemMessages) {
          for (const sysMsg of input.systemMessages) {
            messages.push({ role: 'system', content: sysMsg.content || sysMsg });
          }
        }
        for (const msg of input.inputMessages) {
          messages.push({
            role: msg.role || 'user',
            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          });
        }
      }
    }

    // Get output from the root span
    const output = rootSpan.output as any;
    if (output) {
      if (typeof output === 'string') {
        messages.push({ role: 'assistant', content: output });
      } else if (Array.isArray(output)) {
        // Array of output messages
        for (const msg of output) {
          if (msg.role === 'assistant' && msg.content) {
            messages.push({
              role: 'assistant',
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              toolCalls: msg.toolCalls,
            });
          }
        }
      } else if (output.text) {
        messages.push({ role: 'assistant', content: output.text });
      } else if (output.content) {
        messages.push({
          role: 'assistant',
          content: typeof output.content === 'string' ? output.content : JSON.stringify(output.content),
        });
      }
    }

    return messages;
  }

  async getCount(): Promise<number | undefined> {
    if (this.config?.limit) {
      return this.config.limit;
    }
    return undefined;
  }
}

/**
 * Create a TracesSource from config.
 */
export function createTracesSource(storage: MastraStorage, config: TracesDatasetConfig): TracesSource {
  return new TracesSource(storage, config.filter?.agentName, config.filter);
}
