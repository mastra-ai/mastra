import { EventEmitter } from 'node:events';
import { FlushSentinel, llm, voice } from '@livekit/agents';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mastraLLMNode, observeVoiceSession } from './speech';
import { VOICE_FLUSH_METADATA, VOICE_TURN_METADATA } from './turn-metrics';

afterEach(() => vi.restoreAllMocks());

function fixture(id = 'speech-1') {
  let finish!: () => void;
  const playout = new Promise<void>(resolve => {
    finish = resolve;
  });
  const handle = {
    id,
    interrupted: false,
    exception: () => undefined,
    waitForPlayout: () => playout,
    chatItems: [
      llm.ChatMessage.create({
        role: 'assistant',
        content: 'The answer is',
        extra: { [VOICE_TURN_METADATA]: { turnId: `turn-${id}`, attemptId: `attempt-${id}` } },
        metrics: { startedSpeakingAt: 10, stoppedSpeakingAt: 12, e2eLatency: 0.4 },
      }),
    ],
  };
  return { handle, finish };
}

describe('observeVoiceSession', () => {
  it('waits for playback, reports late interruption and the committed partial transcript', async () => {
    const session = new EventEmitter();
    const onSpeechComplete = vi.fn();
    const onTurnMetrics = vi.fn();
    observeVoiceSession(session as unknown as voice.AgentSession, { onSpeechComplete, onTurnMetrics });
    const { handle, finish } = fixture();
    session.emit(voice.AgentSessionEventTypes.SpeechCreated, { speechHandle: handle });
    await Promise.resolve();
    expect(onSpeechComplete).not.toHaveBeenCalled();
    handle.interrupted = true;
    finish();
    await vi.waitFor(() => expect(onSpeechComplete).toHaveBeenCalledOnce());
    expect(onSpeechComplete.mock.calls[0]![0]).toMatchObject({
      phase: 'speech',
      turnId: 'turn-speech-1',
      attemptId: 'attempt-speech-1',
      speechId: 'speech-1',
      outcome: 'interrupted',
      playedText: 'The answer is',
      measurement: 'server-playout',
      transcriptSource: 'livekit',
      firstAudioMs: 400,
    });
    expect(onSpeechComplete.mock.calls[0]![0].completionMs).toBeUndefined();
    expect(onTurnMetrics.mock.calls[0]![0]).not.toHaveProperty('playedText');
  });

  it('keeps overlapping speech correlated and converts seconds to milliseconds', async () => {
    const session = new EventEmitter();
    const onSpeechComplete = vi.fn();
    observeVoiceSession(session as unknown as voice.AgentSession, { onSpeechComplete });
    const a = fixture('a');
    const b = fixture('b');
    session.emit('speech_created', { speechHandle: a.handle });
    session.emit('speech_created', { speechHandle: b.handle });
    b.finish();
    await vi.waitFor(() => expect(onSpeechComplete).toHaveBeenCalledOnce());
    a.finish();
    await vi.waitFor(() => expect(onSpeechComplete).toHaveBeenCalledTimes(2));
    expect(onSpeechComplete.mock.calls.map(([result]) => result.turnId)).toEqual(['turn-b', 'turn-a']);
    expect(onSpeechComplete.mock.calls[0]![0]).toMatchObject({
      completionMs: 2400,
      speechStartedAt: 10000,
      speechEndedAt: 12000,
    });
  });

  it('finalizes pending speech once on close, with unknown transcript and no invented timings', async () => {
    const session = new EventEmitter();
    const onSpeechComplete = vi.fn();
    const detach = observeVoiceSession(session as unknown as voice.AgentSession, { onSpeechComplete });
    const { handle, finish } = fixture();
    handle.chatItems = [];
    session.emit('speech_created', { speechHandle: handle });
    session.emit('close', {});
    detach();
    finish();
    await vi.waitFor(() => expect(onSpeechComplete).toHaveBeenCalledOnce());
    expect(onSpeechComplete.mock.calls[0]![0]).toMatchObject({ outcome: 'cancelled', transcriptSource: 'unavailable' });
    expect(onSpeechComplete.mock.calls[0]![0].playedText).toBeUndefined();
    expect(onSpeechComplete.mock.calls[0]![0].firstAudioMs).toBeUndefined();
    expect(session.listenerCount('speech_created')).toBe(0);
  });

  it('isolates failing observers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const session = new EventEmitter();
    const onTurnMetrics = vi.fn();
    observeVoiceSession(session as unknown as voice.AgentSession, {
      onTurnMetrics,
      onSpeechComplete: () => {
        throw new Error('observer');
      },
    });
    const { handle, finish } = fixture();
    session.emit('speech_created', { speechHandle: handle });
    finish();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());
    expect(onTurnMetrics).toHaveBeenCalledOnce();
  });
});

it('translates plugin boundary metadata into LiveKit flush markers and propagates cancellation', async () => {
  const cancel = vi.fn();
  vi.spyOn(voice.Agent.default, 'llmNode').mockResolvedValue(
    new ReadableStream({
      start(controller) {
        controller.enqueue({ id: 'a', delta: { role: 'assistant', content: 'One moment.' } });
        controller.enqueue({ id: 'a', delta: { role: 'assistant', extra: { [VOICE_FLUSH_METADATA]: true } } });
      },
      cancel,
    }),
  );
  const output = await mastraLLMNode({} as voice.Agent, llm.ChatContext.empty(), {} as llm.ToolContext, {});
  const reader = output!.getReader();
  expect((await reader.read()).value).toMatchObject({ delta: { content: 'One moment.' } });
  expect((await reader.read()).value).toBe(FlushSentinel);
  await reader.cancel();
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
});
