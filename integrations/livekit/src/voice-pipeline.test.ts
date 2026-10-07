import { ReadableStream } from 'node:stream/web';
import { AudioByteStream, initializeLogger, voice } from '@livekit/agents';
import type { Agent } from '@mastra/core/agent';
import { expect, it, vi } from 'vitest';
import { MastraVoiceAgent } from './bridge';
import { observeVoiceSession } from './speech';

type Frame = ReturnType<AudioByteStream['write']>[number];

class ImmediateOutput extends voice.AudioOutput {
  constructor() {
    super(24000);
  }
  override async captureFrame(frame: Frame) {
    await super.captureFrame(frame);
    this.onPlaybackStarted(Date.now());
  }
  override flush() {
    super.flush();
    this.onPlaybackFinished({ playbackPosition: 0.02, interrupted: false });
  }
  override clearBuffer() {
    this.onPlaybackFinished({ playbackPosition: 0, interrupted: true });
  }
}

it('flushes into the real LiveKit TTS pipeline while a tool is still blocked', async () => {
  initializeLogger({ level: 'silent', pretty: false });
  const segments: string[] = [];
  const onTurnComplete = vi.fn();
  const onSpeechComplete = vi.fn();
  let release!: () => void;
  const blocked = new Promise<void>(resolve => {
    release = resolve;
  });
  class SegmentedAgent extends MastraVoiceAgent {
    override async ttsNode(text: ReadableStream<string> | AsyncIterable<string>): Promise<ReadableStream<Frame>> {
      return new ReadableStream<Frame>({
        async start(controller) {
          let segment = '';
          for await (const part of text) segment += part;
          if (segment) {
            segments.push(segment);
            for (const frame of new AudioByteStream(24000, 1).write(new Int16Array(480))) controller.enqueue(frame);
          }
          controller.close();
        },
      });
    }
  }
  const agent = new SegmentedAgent({
    onTurnComplete,
    toolFeedback: () => 'One moment.',
    agent: {
      stream: async () => ({
        fullStream: (async function* () {
          yield { type: 'tool-call', payload: { toolCallId: 'c1', toolName: 'lookup' } };
          await blocked;
          yield { type: 'tool-result', payload: { toolCallId: 'c1' } };
          yield { type: 'text-delta', payload: { text: 'The answer is 42.' } };
        })(),
      }),
    } as unknown as Agent,
  });
  const session = new voice.AgentSession({ vad: null, turnHandling: { turnDetection: 'manual' } });
  session.output.audio = new ImmediateOutput();
  const detach = observeVoiceSession(session, { onSpeechComplete });
  await session.start({ agent });
  try {
    const handle = session.generateReply({ userInput: 'Look it up.' });
    await vi.waitFor(() => expect(segments).toContain('One moment. '));
    expect(onTurnComplete).not.toHaveBeenCalled();
    expect(onSpeechComplete).not.toHaveBeenCalled();
    release();
    await handle.waitForPlayout();
    await vi.waitFor(() => expect(onSpeechComplete).toHaveBeenCalledOnce());
    expect(segments).toContain('The answer is 42.');
    expect(onSpeechComplete.mock.calls[0]![0]).toMatchObject({
      outcome: 'completed',
      playedText: 'One moment. The answer is 42.',
      attemptId: expect.any(String),
    });
  } finally {
    release();
    detach();
    await session.close();
  }
});
