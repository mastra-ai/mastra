import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const agent = getAgent();

    // Set up event listeners to capture response
    let assistantText = '';
    let audioBuffer: Buffer | null = null;

    const textPromise = new Promise<string>((resolve) => {
      const handler = ({ text: responseText, role }: { text: string; role: string }) => {
        if (role === 'assistant') {
          assistantText = responseText;
          agent.voice.off('writing', handler);
          resolve(responseText);
        }
      };
      agent.voice.on('writing', handler);
    });

    const audioPromise = new Promise<Buffer>((resolve) => {
      const handler = ({ audio }: { audio: Buffer }) => {
        if (audio) {
          audioBuffer = Buffer.from(audio);
          agent.voice.off('speaker', handler);
          resolve(audioBuffer);
        }
      };
      agent.voice.on('speaker', handler);
    });

    // Speak and wait for response
    await agent.voice.speak(text);

    // Wait for text response (with timeout)
    const textResult = await Promise.race([
      textPromise,
      new Promise<string>((resolve) => setTimeout(() => resolve(''), 5000)),
    ]);

    // Wait for audio response (with timeout)
    const audioResult = await Promise.race([
      audioPromise,
      new Promise<Buffer>((resolve) => setTimeout(() => resolve(Buffer.alloc(0)), 5000)),
    ]);

    const response: any = {
      success: true,
      text: textResult || assistantText,
    };

    // Convert audio buffer to base64 data URL if available
    if (audioResult && audioResult.length > 0) {
      const base64 = audioResult.toString('base64');
      response.audioUrl = `data:audio/mpeg;base64,${base64}`;
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Speak failed',
      },
      { status: 500 },
    );
  }
}

