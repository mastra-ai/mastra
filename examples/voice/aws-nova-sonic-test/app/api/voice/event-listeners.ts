import { getAgent } from '@/src/mastra/agents';

// Store event listeners and response queues per connection
export const connections = new Map<string, {
  queue: Array<{
    type: 'text' | 'audio' | 'turnComplete';
    data: any;
    timestamp: number;
  }>;
  controller: ReadableStreamDefaultController;
}>();

// Helper: broadcast an SSE event to all connections, removing stale ones on error
function broadcast(event: Record<string, unknown>) {
  const data = JSON.stringify(event);
  const encoded = new TextEncoder().encode(`data: ${data}\n\n`);
  connections.forEach((conn, connId) => {
    try {
      conn.controller.enqueue(encoded);
    } catch {
      // Connection is stale (client disconnected without cancel)
      connections.delete(connId);
    }
  });
}

// Set up persistent event listeners once per agent instance
let eventListenersSetup = false;
let currentAgentInstanceId: string | undefined = undefined;

export function setupEventListeners() {
  const agent = getAgent();
  const agentInstanceId = (global as any).__mastra_agent_instance_id__;

  // Same agent instance and listeners already set up — nothing to do
  if (eventListenersSetup && currentAgentInstanceId === agentInstanceId) {
    const writingListeners = (agent.voice as any).events?.writing?.length ?? 0;
    if (writingListeners > 0) {
      return; // Listeners are good
    }
    // Listeners went missing, force re-setup
    console.warn('[Events] Writing listeners missing, re-attaching...');
    eventListenersSetup = false;
  }

  // New agent instance — reset flag
  if (eventListenersSetup && currentAgentInstanceId !== agentInstanceId) {
    console.log('[Events] Agent instance changed, re-setting up listeners');
    eventListenersSetup = false;
  }

  const voiceState = (agent.voice as any).state;
  console.log('[Events] Setting up event listeners, agent:', agentInstanceId, 'voice state:', voiceState);

  // User and Assistant transcription
  agent.voice.on('writing', ({ text, role, generationStage }: { text: string; role: string; generationStage?: string }) => {
    if (!text || typeof text !== 'string' || text.trim().length === 0) return;
    console.log('[Events] Writing:', role, generationStage || 'unknown', text.substring(0, 80));
    broadcast({ type: 'text', data: { text, role, generationStage }, timestamp: Date.now() });
  });

  // Audio output
  agent.voice.on('speaking', ({ audio, audioData }: { audio?: Buffer | string; audioData?: Buffer }) => {
    const audioBase64 = typeof audio === 'string' ? audio : undefined;
    const audioBuffer = audioData || (Buffer.isBuffer(audio) ? audio : undefined);
    if (audioBase64 || audioBuffer) {
      broadcast({
        type: 'audio',
        data: {
          audio: audioBase64 || (audioBuffer ? Array.from(audioBuffer) : []),
          isBase64: !!audioBase64,
        },
        timestamp: Date.now(),
      });
    }
  });

  // Content end
  agent.voice.on('contentEnd', (data: any) => {
    console.log('[Events] Content end:', data);
    broadcast({ type: 'contentEnd', data: data, timestamp: Date.now() });
  });

  // Turn complete
  agent.voice.on('turnComplete', (data: any) => {
    console.log('[Events] Turn complete');
    broadcast({ type: 'turnComplete', data: data || {}, timestamp: Date.now() });
  });

  // Interrupt (barge-in)
  agent.voice.on('interrupt', ({ type }: { type: string }) => {
    console.log('[Events] Interrupt:', type);
    broadcast({ type: 'interrupt', data: { type }, timestamp: Date.now() });
  });

  eventListenersSetup = true;
  currentAgentInstanceId = agentInstanceId;
  console.log('[Events] Event listeners set up for agent:', agentInstanceId);
}
