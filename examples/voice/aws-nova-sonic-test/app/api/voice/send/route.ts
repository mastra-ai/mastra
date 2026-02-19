import { getAgent } from '@/src/mastra/agents';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type');
    let base64Audio: string;
    let isChunk = false;

    if (contentType?.includes('application/json')) {
      // New format: base64-encoded PCM audio
      const body = await request.json();
      base64Audio = body.audio;
      isChunk = body.chunk === true;

      if (!base64Audio) {
        return NextResponse.json({ error: 'Audio data is required' }, { status: 400 });
      }
    } else {
      // Legacy format: WebM blob (for backward compatibility)
      const formData = await request.formData();
      const audioFile = formData.get('audio') as File;

      if (!audioFile) {
        return NextResponse.json({ error: 'Audio file is required' }, { status: 400 });
      }

      // Convert WebM to base64 (this is a fallback - should use PCM format)
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Audio = buffer.toString('base64');
    }

    const agent = getAgent();
    const agentInstanceId = (global as any).__mastra_agent_instance_id__;

    // Check connection state before sending
    const voiceState = (agent.voice as any).state;

    // Verify event listeners are set up for this agent instance
    const voiceEvents = (agent.voice as any).events;
    const writingListeners = voiceEvents?.writing?.length ?? 0;
    if (writingListeners === 0) {
      console.error(`[API] No writing event listeners attached! Setting up now...`);
      const { setupEventListeners } = await import('../event-listeners');
      setupEventListeners();
    }

    if (voiceState !== 'connected') {
      console.error(`[API] Voice is not connected (state: ${voiceState}). Cannot send audio.`);
      if (isChunk) {
        return NextResponse.json({
          success: false,
          chunk: true,
          error: `Voice not connected (state: ${voiceState})`
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: `Voice not connected (state: ${voiceState}). Please connect first.`
        },
        { status: 400 }
      );
    }

    // Convert base64 to Buffer and then to Readable stream
    const audioChunkBuffer = Buffer.from(base64Audio, 'base64');
    const audioStream = Readable.from([audioChunkBuffer]);

    // Send audio chunk
    try {
      await agent.voice.send(audioStream);
    } catch (error) {
      console.error('[API] Error sending audio to voice:', error);
      if (isChunk) {
        return NextResponse.json({ success: true, chunk: true, warning: 'Error sending chunk' });
      }
      throw error;
    }

    // For streaming chunks, return immediately.
    // Responses come through SSE events set up in event-listeners.ts.
    // IMPORTANT: Do NOT register per-request event listeners for chunks -
    // they would accumulate and leak since each chunk creates handlers
    // that are never cleaned up.
    if (isChunk) {
      return NextResponse.json({ success: true, chunk: true });
    }

    // For complete turns (non-chunk mode), set up listeners and wait for responses
    let userText = '';
    let assistantText = '';
    let collectedAudioBuffer: Buffer | null = null;

    const userTextPromise = new Promise<string>((resolve) => {
      const handler = ({ text: responseText, role }: { text: string; role: string }) => {
        if (role === 'user') {
          userText = responseText;
          agent.voice.off('writing', handler);
          resolve(responseText);
        }
      };
      agent.voice.on('writing', handler);
    });

    const assistantTextPromise = new Promise<string>((resolve) => {
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
      let collectedAudio: Buffer[] = [];
      let turnCompleteReceived = false;

      const speakingHandler = ({ audio }: any) => {
        if (audio) {
          collectedAudio.push(Buffer.from(audio));
        }
      };

      const turnCompleteHandler = () => {
        turnCompleteReceived = true;
        agent.voice.off('speaking', speakingHandler);
        agent.voice.off('turnComplete', turnCompleteHandler);

        if (collectedAudio.length > 0) {
          collectedAudioBuffer = Buffer.concat(collectedAudio);
          resolve(collectedAudioBuffer);
        } else {
          resolve(Buffer.alloc(0));
        }
      };

      agent.voice.on('speaking', speakingHandler);
      agent.voice.on('turnComplete', turnCompleteHandler);

      // Fallback timeout
      setTimeout(() => {
        if (!turnCompleteReceived) {
          console.log('[API] Timeout waiting for turnComplete, resolving with collected audio');
          agent.voice.off('speaking', speakingHandler);
          agent.voice.off('turnComplete', turnCompleteHandler);
          if (collectedAudio.length > 0) {
            collectedAudioBuffer = Buffer.concat(collectedAudio);
            resolve(collectedAudioBuffer);
          } else {
            resolve(Buffer.alloc(0));
          }
        }
      }, 60000);
    });

    // Wait for responses (with timeout)
    const [userTextResult, assistantTextResult, audioResult] = await Promise.all([
      Promise.race([
        userTextPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve(''), 30000)),
      ]),
      Promise.race([
        assistantTextPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve(''), 30000)),
      ]),
      Promise.race([
        audioPromise,
        new Promise<Buffer>((resolve) => setTimeout(() => resolve(Buffer.alloc(0)), 30000)),
      ]),
    ]);

    const response: any = {
      success: true,
      userText: userTextResult || userText,
      assistantText: assistantTextResult || assistantText,
    };

    if (audioResult && audioResult.length > 0) {
      response.assistantAudio = {
        data: Array.from(audioResult),
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      },
      { status: 500 },
    );
  }
}
