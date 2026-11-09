/** A speech segment boundary, separate from its text. Safe to import in server code. */
export const VOICE_TEXT_FLUSH = Object.freeze({ type: 'voice-text-flush' as const });
export type VoiceReplyChunk = string | typeof VOICE_TEXT_FLUSH;

export type VoiceOutcome = 'completed' | 'interrupted' | 'cancelled' | 'failed';

export interface VoiceTurnIdentity {
  /** The triggering user message ID, or a generated ID for speech without user input. */
  turnId: string;
  /** Unique for each generation, including speculative attempts and retries. */
  attemptId: string;
}

export interface VoiceToolTiming {
  toolCallId: string;
  toolName: string;
  /** Observed at the bridge, relative to generation start. Not server execution time. */
  startedAtMs: number;
  durationMs?: number;
}

export interface VoiceGenerationMetrics extends VoiceTurnIdentity {
  version: 1;
  phase: 'generation';
  outcome: VoiceOutcome;
  /** Unix epoch milliseconds, for trace correlation. Durations use a monotonic clock. */
  startedAt: number;
  durationMs: number;
  /** First text sent toward TTS; can include tool-feedback filler. */
  firstTextMs?: number;
  tools: VoiceToolTiming[];
}

export interface VoiceSpeechMetrics {
  version: 1;
  phase: 'speech';
  turnId: string;
  attemptId?: string;
  speechId: string;
  outcome: VoiceOutcome;
  measurement: 'server-playout';
  /** Epoch milliseconds. Absent when LiveKit has no aligned timing. */
  speechStartedAt?: number;
  speechEndedAt?: number;
  /** User speech end to first output audio. Includes filler; not browser receipt. */
  firstAudioMs?: number;
  /** User speech end to completed output. Omitted for interrupted/cancelled/failed speech. */
  completionMs?: number;
}

export type VoiceTurnMetrics = VoiceGenerationMetrics | VoiceSpeechMetrics;
export type VoiceTurnMetricsHook = (metrics: VoiceTurnMetrics) => void | Promise<void>;

export interface VoiceSpeechResult extends VoiceSpeechMetrics {
  /** LiveKit's committed playback transcript, potentially partial or estimated. Not proof of hearing. */
  playedText?: string;
  transcriptSource: 'livekit' | 'unavailable';
}
export type VoiceSpeechCompleteHook = (result: VoiceSpeechResult) => void | Promise<void>;

/** Observer failures must never break speech or delay the audio path. */
export function notifyVoiceObserver<T>(hook: ((value: T) => void | Promise<void>) | undefined, value: T): void {
  if (!hook) return;
  void Promise.resolve()
    .then(() => hook(value))
    .catch(error => {
      console.warn('@mastra/livekit: voice observer threw', error);
    });
}

export const VOICE_TURN_METADATA = 'mastra.voice.turn';
export const VOICE_FLUSH_METADATA = 'mastra.voice.flush';

/** Internal per-attempt clock; never mixes durations from different machines. */
export function createGenerationMetrics(identity: VoiceTurnIdentity, hook?: VoiceTurnMetricsHook) {
  const start = performance.now();
  const startedAt = Date.now();
  let firstTextMs: number | undefined;
  let ended = false;
  const tools: VoiceToolTiming[] = [];
  return {
    text() {
      firstTextMs ??= performance.now() - start;
    },
    toolStart(tool: { toolCallId: string; toolName: string }) {
      tools.push({ ...tool, startedAtMs: performance.now() - start });
    },
    toolEnd(id: string) {
      const tool = tools.find(t => t.toolCallId === id && t.durationMs === undefined);
      if (tool) tool.durationMs = performance.now() - start - tool.startedAtMs;
    },
    end(outcome: VoiceOutcome) {
      if (ended) return;
      ended = true;
      notifyVoiceObserver(hook, {
        version: 1,
        phase: 'generation',
        ...identity,
        startedAt,
        durationMs: performance.now() - start,
        firstTextMs,
        outcome,
        tools: tools.map(tool => ({ ...tool })),
      });
    },
  };
}
