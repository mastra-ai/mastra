import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';
import { setupEventListeners } from '../event-listeners';

export async function POST(request: Request) {
  try {
    console.log('[API] Connect request received');
    
    // Parse request body for configuration options
    let options: { speaker?: string; endpointingSensitivity?: 'HIGH' | 'MEDIUM' | 'LOW' } | undefined;
    try {
      const body = await request.json().catch(() => ({}));
      if (body.speaker || body.endpointingSensitivity) {
        options = {
          speaker: body.speaker,
          endpointingSensitivity: body.endpointingSensitivity,
        };
        console.log('[API] Connect with options:', options);
      }
    } catch (err) {
      // No body or invalid JSON, use defaults
    }
    
    const agent = getAgent(options);
    
    // Check if already connected
    const currentState = (agent.voice as any).state;
    console.log('[API] Current voice state:', currentState);
    
    if (currentState === 'connected') {
      console.log('[API] Already connected, ensuring event listeners are set up...');
      // Still set up listeners in case they weren't set up before
      setupEventListeners();
      return NextResponse.json({ success: true, status: 'connected', message: 'Already connected' });
    }
    
    console.log('[API] Attempting to connect...');
    
    // CRITICAL: Set up event listeners AFTER connecting, not before
    // This ensures listeners are attached to the connected agent instance
    // Setting up before connection might attach to a different instance
    
    // Add timeout to prevent hanging
    const connectPromise = agent.voice.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    
    // Verify connection state after connecting
    const finalState = (agent.voice as any).state;
    console.log('[API] Connection successful, final voice state:', finalState);
    
    if (finalState !== 'connected') {
      console.warn('[API] WARNING: Connection completed but state is not "connected":', finalState);
    }
    
    // CRITICAL: Set up event listeners AFTER connection is established
    // This ensures we're attaching to the correct connected agent instance
    console.log('[API] Setting up event listeners AFTER connection...');
    const agentInstanceId = (global as any).__mastra_agent_instance_id__;
    console.log('[API] Agent instance ID:', agentInstanceId);
    setupEventListeners();
    console.log('[API] Event listeners set up after connection');
    
    // Verify listeners are attached
    const voiceEvents = (agent.voice as any).events;
    const writingListeners = voiceEvents?.writing?.length ?? 0;
    console.log('[API] Writing event listeners count:', writingListeners);
    
    return NextResponse.json({ success: true, status: 'connected', voiceState: finalState });
  } catch (error) {
    console.error('[API] Connection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Connection failed';
    console.error('[API] Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

