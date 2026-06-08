// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { playStreamWithWebAudio } from '@mastra/react';
import { VoiceAttachmentAdapter } from './voice-adapter';

vi.mock('@mastra/react', () => ({
  playStreamWithWebAudio: vi.fn(),
}));

const playStreamWithWebAudioMock = vi.mocked(playStreamWithWebAudio);

const createAgent = () => {
  const speak = vi.fn(async () => new Response(new ReadableStream()));
  return {
    agent: { voice: { speak } },
    speak,
  };
};

beforeEach(() => {
  playStreamWithWebAudioMock.mockReset();
  playStreamWithWebAudioMock.mockResolvedValue(vi.fn());
});

describe('VoiceAttachmentAdapter', () => {
  it('plays raw response bodies through web audio', async () => {
    const stream = new ReadableStream();
    const speak = vi.fn(async () => new Response(stream));
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);

    await vi.waitFor(() => expect(playStreamWithWebAudioMock).toHaveBeenCalledWith(stream, expect.any(Function)));
    expect(speak).toHaveBeenCalledWith('hello');
    expect(subscriber).toHaveBeenCalledWith();
    expect(utterance.status).toEqual({ type: 'running' });
  });

  it('does not duplicate speech requests for multiple subscribers', async () => {
    const { agent, speak } = createAgent();
    const adapter = new VoiceAttachmentAdapter(agent as never);
    const utterance = adapter.speak('hello');

    utterance.subscribe(vi.fn());
    utterance.subscribe(vi.fn());

    await vi.waitFor(() => expect(playStreamWithWebAudioMock).toHaveBeenCalledTimes(1));
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('notifies subscribers when playback finishes', async () => {
    const cleanup = vi.fn();
    playStreamWithWebAudioMock.mockResolvedValueOnce(cleanup);
    const { agent } = createAgent();
    const adapter = new VoiceAttachmentAdapter(agent as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);

    await vi.waitFor(() => expect(playStreamWithWebAudioMock).toHaveBeenCalled());
    const onEnded = playStreamWithWebAudioMock.mock.calls[0]![1]!;
    onEnded();

    expect(utterance.status).toEqual({ type: 'ended', reason: 'finished', error: undefined });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(subscriber).toHaveBeenCalledTimes(3);
  });

  it('reports errors to subscribers', async () => {
    const error = new Error('tts failed');
    const speak = vi.fn(async () => {
      throw error;
    });
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);

    await vi.waitFor(() => expect(utterance.status).toEqual({ type: 'ended', reason: 'error', error }));
    expect(subscriber).toHaveBeenCalledTimes(3);
  });

  it('cancels pending playback without later marking it successful', async () => {
    let resolveSpeak: (value: Response) => void = () => {};
    const stream = new ReadableStream();
    const speak = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveSpeak = resolve;
        }),
    );
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);
    utterance.cancel();
    resolveSpeak(new Response(stream));

    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(playStreamWithWebAudioMock).not.toHaveBeenCalled();
    expect(utterance.status).toEqual({ type: 'ended', reason: 'cancelled', error: undefined });
  });
});
