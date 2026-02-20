import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { endpointingSensitivity } = body;

    if (endpointingSensitivity && !['HIGH', 'MEDIUM', 'LOW'].includes(endpointingSensitivity)) {
      return NextResponse.json(
        { success: false, error: 'Invalid endpointingSensitivity. Must be HIGH, MEDIUM, or LOW.' },
        { status: 400 }
      );
    }

    console.log('[API] Update config request received, endpointingSensitivity:', endpointingSensitivity);
    
    const agent = getAgent({ endpointingSensitivity });
    const currentState = (agent.voice as any).state;

    // Note: Endpointing sensitivity changes require reconnection to take effect
    // This endpoint updates the config for the next connection
    if (currentState === 'connected') {
      return NextResponse.json({
        success: true,
        message: 'Configuration updated. Please disconnect and reconnect for changes to take effect.',
        requiresReconnect: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Configuration updated. Changes will apply on next connection.',
    });
  } catch (error) {
    console.error('[API] Update config error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update configuration';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}

