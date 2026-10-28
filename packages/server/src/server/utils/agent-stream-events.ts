import type {
  AgentChunkEventData,
  AgentErrorEventData,
  AgentFinishEventData,
  AgentStreamEvent,
} from '@mastra/core/agent/durable';
import { ChunkFrom } from '@mastra/core/stream';

type ObservedAgentFrame =
  | AgentChunkEventData
  | { type: 'error'; payload: { error: AgentErrorEventData['error'] } }
  | {
      type: 'finish';
      runId: string;
      from: ChunkFrom;
      payload: {
        output: unknown;
        stepResult: Pick<AgentFinishEventData['stepResult'], 'reason'> & {
          warnings?: unknown[];
          isContinued?: boolean;
        };
        messages?: AgentFinishEventData['messages'];
      };
    };

// Keep the HTTP wire shape aligned with core's createDurableAgentStream without
// subscribing again or rerunning output processors. Offsets still count raw events.
export function toAgentStreamChunks(event: AgentStreamEvent): ObservedAgentFrame[] {
  const { runId } = event;
  const abort = { type: 'abort' as const, runId, from: ChunkFrom.AGENT, payload: {} };
  switch (event.type) {
    case 'chunk':
      return [event.data as AgentChunkEventData];
    case 'step-start': {
      const chunk = event.data as AgentChunkEventData;
      return chunk && 'type' in chunk ? [chunk] : [];
    }
    case 'finish': {
      const data = event.data as AgentFinishEventData;
      let raw = data.output?.usage && 'raw' in data.output.usage ? data.output.usage.raw : undefined;
      // Public fullStream retains the latest defined step raw across its finish-usage reset.
      for (const step of [...(data.output?.steps ?? [])].reverse()) {
        const usage = step && typeof step === 'object' && 'usage' in step ? step.usage : undefined;
        if (usage && typeof usage === 'object' && 'raw' in usage && usage.raw !== undefined) {
          raw = usage.raw;
          break;
        }
      }
      const finish = {
        type: 'finish' as const,
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          output: raw === undefined ? data.output : { ...data.output, usage: { ...data.output.usage, raw } },
          stepResult: data.stepResult,
          ...(data.messages ? { messages: data.messages } : {}),
        },
      };
      return data.stepResult?.reason === 'abort' ? [abort, finish] : [finish];
    }
    case 'abort': {
      const data = event.data as { text?: string; steps: unknown[] };
      return [
        abort,
        {
          type: 'finish' as const,
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            output: {
              text: data.text,
              steps: data.steps,
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            },
            stepResult: { reason: 'abort' as const, warnings: [], isContinued: false },
          },
        },
      ];
    }
    case 'error': {
      const data = event.data as AgentErrorEventData;
      return [{ type: 'error', payload: { error: { ...data.error } } }];
    }
    default:
      return [];
  }
}
