// @vitest-environment jsdom
import { playStreamWithWebAudio } from '@mastra/react';
import { toast } from 'sonner';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VoiceAttachmentAdapter } from './voice-adapter';


vi.mock('@mastra/react', () => ({
  playStreamWithWebAudio: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

const playStreamWithWebAudioMock = vi.mocked(playStreamWithWebAudio);
const toastErrorMock = vi.mocked(toast.error);

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
  toastErrorMock.mockReset();
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
    // One initial notification on subscribe + one on the terminal transition.
    expect(subscriber).toHaveBeenCalledTimes(2);
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
    // One initial notification on subscribe + one on the terminal transition.
    expect(subscriber).toHaveBeenCalledTimes(2);
  });

  it('shows a quota-specific toast when the provider returns 429', async () => {
    const error = Object.assign(new Error('Too Many Requests'), {
      status: 429,
      body: { error: '429 You exceeded your current quota' },
    });
    const speak = vi.fn(async () => {
      throw error;
    });
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);

    adapter.speak('hello').subscribe(vi.fn());

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(toastErrorMock).toHaveBeenCalledWith(expect.stringContaining('quota'));
  });

  it('surfaces the provider error message in a toast for non-429 failures', async () => {
    const error = Object.assign(new Error('boom'), { body: { error: 'Agent does not have voice capabilities' } });
    const speak = vi.fn(async () => {
      throw error;
    });
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);

    adapter.speak('hello').subscribe(vi.fn());

    await vi.waitFor(() => expect(toastErrorMock).toHaveBeenCalledTimes(1));
    expect(toastErrorMock).toHaveBeenCalledWith('Voice generation failed: Agent does not have voice capabilities');
  });

  it('does not toast when playback finishes successfully', async () => {
    const cleanup = vi.fn();
    playStreamWithWebAudioMock.mockResolvedValueOnce(cleanup);
    const { agent } = createAgent();
    const adapter = new VoiceAttachmentAdapter(agent as never);
    const utterance = adapter.speak('hello');

    utterance.subscribe(vi.fn());
    await vi.waitFor(() => expect(playStreamWithWebAudioMock).toHaveBeenCalled());
    playStreamWithWebAudioMock.mock.calls[0]![1]!();

    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('does not toast when speech is cancelled', async () => {
    let resolveSpeak: (value: Response) => void = () => {};
    const speak = vi.fn(
      () =>
        new Promise<Response>(resolve => {
          resolveSpeak = resolve;
        }),
    );
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);
    const utterance = adapter.speak('hello');

    utterance.subscribe(vi.fn());
    utterance.cancel();
    resolveSpeak(new Response(new ReadableStream()));

    await vi.waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('notifies a single subscriber exactly once before any transition', async () => {
    const { agent } = createAgent();
    const adapter = new VoiceAttachmentAdapter(agent as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);

    // The initial subscribe should deliver current state exactly once, not twice.
    expect(subscriber).toHaveBeenCalledTimes(1);
    expect(utterance.status).toEqual({ type: 'running' });
  });

  it('ends the utterance when speak() returns no stream body', async () => {
    const speak = vi.fn(async () => new Response(null));
    const adapter = new VoiceAttachmentAdapter({ voice: { speak } } as never);
    const utterance = adapter.speak('hello');
    const subscriber = vi.fn();

    utterance.subscribe(subscriber);

    await vi.waitFor(() => expect(utterance.status.type).toBe('ended'));
    expect(utterance.status).toMatchObject({ type: 'ended', reason: 'error' });
    expect(playStreamWithWebAudioMock).not.toHaveBeenCalled();
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
