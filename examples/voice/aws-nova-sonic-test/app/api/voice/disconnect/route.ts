import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const agent = getAgent();
    agent.voice.close();
    return NextResponse.json({ success: true, status: 'disconnected' });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      },
      { status: 500 },
    );
  }
}

