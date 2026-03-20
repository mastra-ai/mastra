import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const agent = getAgent();
    const voiceState = (agent.voice as any).state;
    
    if (voiceState !== 'connected') {
      return NextResponse.json(
        { 
          success: false, 
          error: `Voice not connected (state: ${voiceState}). Please connect first.` 
        },
        { status: 400 }
      );
    }

    // Call endAudioInput to send contentEnd event
    await (agent.voice as any).endAudioInput();
    
    console.log('[API] Audio input ended (contentEnd sent)');
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error ending audio input:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to end audio input',
      },
      { status: 500 },
    );
  }
}

