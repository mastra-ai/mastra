import type { Agent as MastraAgent } from '@mastra/core/agent';
import type { RequestContext } from '@mastra/core/request-context';
import type { MastraStreamOptions } from './bridge';
import type { MastraAgentChunk, VoiceAgentTransport, VoiceTurn } from './transport';
import { ensureVoiceCallThread, persistSpokenGreeting } from './voice-thread';

export interface InProcessTransportOptions {
  /** Request context used when resolving memory/instructions for this session. */
  requestContext?: RequestContext;
  /** Extra options merged into every `agent.stream()` call. */
  streamOptions?: MastraStreamOptions;
}

/**
 * Runs the Mastra agent inside the LiveKit worker process: `stream` calls
 * `agent.stream()` directly and returns its `fullStream`, with zero network hops. This is
 * the default transport and what {@link createLiveKitWorker} uses when given a `mastra`
 * instance and `agent`.
 */
export function inProcessTransport(agent: MastraAgent, options: InProcessTransportOptions = {}): VoiceAgentTransport {
  const getMemory = () => agent.getMemory({ requestContext: options.requestContext });

  return {
    async stream({ messages, memory, requestContext, abortSignal }: VoiceTurn): Promise<AsyncIterable<MastraAgentChunk>> {
      const streamOptions: MastraStreamOptions = { ...options.streamOptions, abortSignal };
      if (memory) streamOptions.memory = memory;
      if (requestContext) streamOptions.requestContext = requestContext;
      const result = await agent.stream(messages, streamOptions);
      return result.fullStream as AsyncIterable<MastraAgentChunk>;
    },

    async getInstructions({ requestContext }) {
      try {
        const instructions = await agent.getInstructions({ requestContext: requestContext ?? options.requestContext });
        return typeof instructions === 'string' ? instructions : undefined;
      } catch {
        return undefined;
      }
    },

    supportsMemory() {
      return agent.hasOwnMemory();
    },

    async ensureThread({ memory, roomName }) {
      const memoryInstance = await getMemory();
      if (!memoryInstance) return;
      await ensureVoiceCallThread({
        memory: memoryInstance,
        threadId: memory.thread,
        resourceId: memory.resource ?? memory.thread,
        roomName,
      });
    },

    async persistGreeting({ memory, greeting }) {
      const memoryInstance = await getMemory();
      if (!memoryInstance) return;
      await persistSpokenGreeting({
        memory: memoryInstance,
        threadId: memory.thread,
        resourceId: memory.resource ?? memory.thread,
        greeting,
      });
    },
  };
}
