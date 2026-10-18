import { FlushSentinel, voice } from '@livekit/agents';
import type { llm } from '@livekit/agents';
import { notifyVoiceObserver, VOICE_FLUSH_METADATA, VOICE_TURN_METADATA } from './turn-metrics';
import type { VoiceOutcome, VoiceSpeechCompleteHook, VoiceSpeechResult, VoiceTurnMetricsHook } from './turn-metrics';
import { mapVoiceStream } from './voice-stream';

/**
 * Use from a custom Agent.llmNode when using MastraLLM. LiveKit's LLMStream only accepts
 * ChatChunks; this node translates our boundary metadata into LiveKit's supported marker.
 */
export async function mastraLLMNode(
  agent: voice.Agent,
  chatCtx: llm.ChatContext,
  toolCtx: llm.ToolContext,
  modelSettings: voice.ModelSettings,
): Promise<ReadableStream<llm.ChatChunk | string | FlushSentinel> | null> {
  const source = await voice.Agent.default.llmNode(agent, chatCtx, toolCtx, modelSettings);
  if (!source) return null;
  return mapVoiceStream(source, chunk => {
    if (typeof chunk === 'object' && chunk.delta?.extra?.[VOICE_FLUSH_METADATA] === true) {
      return FlushSentinel;
    } else {
      return chunk;
    }
  });
}

export interface ObserveVoiceSessionOptions {
  onTurnMetrics?: VoiceTurnMetricsHook;
  onSpeechComplete?: VoiceSpeechCompleteHook;
}

function speechResult(handle: voice.SpeechHandle, outcome: VoiceOutcome): VoiceSpeechResult {
  const messages = handle.chatItems.filter(
    (item): item is llm.ChatMessage => item.type === 'message' && item.role === 'assistant',
  );
  const identities = messages.map(
    message => message.extra[VOICE_TURN_METADATA] as { turnId?: unknown; attemptId?: unknown } | undefined,
  );
  const identity = identities[0];
  const sameIdentity = identities.every(
    value => value?.turnId === identity?.turnId && value?.attemptId === identity?.attemptId,
  );
  const starts = messages
    .map(message => message.metrics.startedSpeakingAt)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const stops = messages
    .map(message => message.metrics.stoppedSpeakingAt)
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  const firstAudio = messages
    .map(message => message.metrics.e2eLatency)
    .find(n => typeof n === 'number' && Number.isFinite(n));
  const speechStartedAt = starts.length ? Math.min(...starts) * 1000 : undefined;
  const speechEndedAt = stops.length ? Math.max(...stops) * 1000 : undefined;
  const firstAudioMs = firstAudio === undefined ? undefined : firstAudio * 1000;
  const playedText = messages.map(message => message.textContent).join('');
  return {
    version: 1,
    phase: 'speech',
    turnId: sameIdentity && typeof identity?.turnId === 'string' ? identity.turnId : handle.id,
    attemptId: sameIdentity && typeof identity?.attemptId === 'string' ? identity.attemptId : undefined,
    speechId: handle.id,
    outcome,
    measurement: 'server-playout',
    speechStartedAt,
    speechEndedAt,
    firstAudioMs,
    completionMs:
      outcome === 'completed' &&
      firstAudioMs !== undefined &&
      speechStartedAt !== undefined &&
      speechEndedAt !== undefined
        ? firstAudioMs + speechEndedAt - speechStartedAt
        : undefined,
    playedText: messages.length ? playedText : undefined,
    transcriptSource: messages.length ? 'livekit' : 'unavailable',
  };
}

/**
 * Attach before session.start(). Observes generation-independent playback completion;
 * never writes memory. Return value detaches listeners and finalizes pending speech as cancelled.
 * LiveKit's transcript can be estimated. Server output cannot confirm remote human hearing.
 */
export function observeVoiceSession(session: voice.AgentSession, options: ObserveVoiceSessionOptions): () => void {
  const pending = new Set<voice.SpeechHandle>();
  let detached = false;
  const finish = (handle: voice.SpeechHandle, outcome: VoiceOutcome) => {
    if (!pending.delete(handle)) return;
    const result = speechResult(handle, outcome);
    const { playedText: _text, transcriptSource: _source, ...metrics } = result;
    notifyVoiceObserver(options.onTurnMetrics, metrics);
    notifyVoiceObserver(options.onSpeechComplete, result);
  };
  const onSpeech = ({ speechHandle }: voice.SpeechCreatedEvent) => {
    if (detached || pending.has(speechHandle)) return;
    pending.add(speechHandle);
    void speechHandle.waitForPlayout().then(
      () => {
        finish(
          speechHandle,
          speechHandle.exception() ? 'failed' : speechHandle.interrupted ? 'interrupted' : 'completed',
        );
      },
      () => finish(speechHandle, 'failed'),
    );
  };
  const detach = (outcome: VoiceOutcome) => {
    if (detached) return;
    detached = true;
    session.off(voice.AgentSessionEventTypes.SpeechCreated, onSpeech);
    session.off(voice.AgentSessionEventTypes.Close, onClose);
    for (const handle of pending) finish(handle, outcome);
  };
  const onClose = (event: voice.CloseEvent) => detach(event.error ? 'failed' : 'cancelled');
  session.on(voice.AgentSessionEventTypes.SpeechCreated, onSpeech);
  session.on(voice.AgentSessionEventTypes.Close, onClose);
  return () => detach('cancelled');
}
