import { recordMicrophoneToFile } from '@mastra/react';
import { transcribeGatewayAudio } from '@mastra/playground-ui/utils/gateway-audio';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import type { LiveSessionResponse, TranscribeResponse } from '../../../../api/types';
import { liveDictationSupported, startLiveDictation } from '../services/liveDictation';
import type { LiveDictation, LiveDictationSession } from '../services/liveDictation';

type RecordingPhase = 'idle' | 'requesting' | 'recording' | 'finishing';
export type VoiceDictationState = 'idle' | 'requesting' | 'recording' | 'transcribing';

export function voiceDictationSupported(): boolean {
  return typeof window.MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

const MIC_BLOCKED = 'Microphone access was blocked. Allow it in your browser to use voice input.';
const RECORDING_UNSUPPORTED = 'This browser could not start recording. Try again or use another browser.';
const CAPTURE_ERRORS: Record<string, string> = {
  NotAllowedError: MIC_BLOCKED,
  SecurityError: MIC_BLOCKED,
  NotFoundError: 'No microphone found. Connect one to use voice input.',
  NotReadableError: 'Your microphone is busy in another app. Close it and try again.',
  NotSupportedError: RECORDING_UNSUPPORTED,
};
const MIC_FAILED = 'Could not start the microphone. Try again.';
const SERVER_ERRORS: Record<string, string> = {
  voice_rate_limited: 'Too many voice requests. Wait a minute and try again.',
};
const NO_SPEECH = 'No speech detected.';

function captureErrorMessage(error: unknown): string {
  return (error instanceof DOMException && CAPTURE_ERRORS[error.name]) || MIC_FAILED;
}

function serverErrorMessage(error: Error): string {
  return SERVER_ERRORS[error.message] ?? error.message;
}

function releaseMicrophone(stream: MediaStream) {
  stream.getTracks().forEach(track => track.stop());
}

interface Capture {
  stop(): void;
  cancel(): void;
}

export interface VoiceDictation {
  state: VoiceDictationState;
  start(): Promise<void>;
  stop(): void;
}

export function useVoiceDictation({
  factoryId,
  onTranscript,
  onError,
  gateway,
}: {
  factoryId: string | undefined;
  onTranscript: (transcript: string, replacing: string) => void;
  onError: (message: string) => void;
  gateway?: { baseUrl: string; model: string };
}): VoiceDictation {
  const { client } = useApiConfig();
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const captureRef = useRef<Capture>(undefined);
  const mountedRef = useRef(true);
  const query = factoryId ? `?factoryId=${encodeURIComponent(factoryId)}` : '';

  const transcribe = useMutation({
    mutationFn: async (clip: File) => {
      if (gateway) {
        const extension = clip.name.split('.').pop() || 'webm';
        return { text: await transcribeGatewayAudio(gateway.baseUrl, gateway.model, clip, extension) };
      }
      return client.post<TranscribeResponse>(`/web/voice/transcribe${query}`, clip);
    },
    onSuccess: ({ text }) => {
      if (text) onTranscript(text, '');
      else onError(NO_SPEECH);
    },
    onError: error => onError(serverErrorMessage(error)),
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      captureRef.current?.cancel();
      captureRef.current = undefined;
    };
  }, []);

  const fail = (message: string) => {
    if (!mountedRef.current) return;
    setPhase('idle');
    onError(message);
  };

  const recordClip = async () => {
    const recorder = await recordMicrophoneToFile(file => {
      captureRef.current = undefined;
      if (!mountedRef.current) return;
      setPhase('idle');
      if (file.size > 0) transcribe.mutate(file);
    });
    if (!mountedRef.current) {
      releaseMicrophone(recorder.stream);
      return;
    }
    try {
      recorder.start();
    } catch (error) {
      releaseMicrophone(recorder.stream);
      throw error;
    }
    const stopRecorder = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };
    captureRef.current = { stop: stopRecorder, cancel: stopRecorder };
    setPhase('recording');
  };

  const dictateLive = async (session: LiveDictationSession) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    if (!mountedRef.current) {
      releaseMicrophone(stream);
      return;
    }
    let shown = '';
    const show = (transcript: string) => {
      const next = transcript.trim();
      if (!mountedRef.current || !next || next === shown) return;
      onTranscript(next, shown);
      shown = next;
    };
    let dictation: LiveDictation;
    try {
      dictation = startLiveDictation({ session, stream, onText: show });
    } catch {
      releaseMicrophone(stream);
      fail(RECORDING_UNSUPPORTED);
      return;
    }
    captureRef.current = dictation;
    setPhase('recording');
    const outcome = await dictation.finished;
    if (captureRef.current === dictation) captureRef.current = undefined;
    if (!mountedRef.current) return;
    show(outcome.transcript);
    if ('error' in outcome) fail(outcome.error);
    else if (!shown) fail(NO_SPEECH);
    else setPhase('idle');
  };

  const start = async () => {
    setPhase('requesting');
    if (gateway) {
      try {
        await recordClip();
      } catch (error) {
        fail(captureErrorMessage(error));
      }
      return;
    }
    let session: LiveSessionResponse;
    try {
      session = await client.post<LiveSessionResponse>(`/web/voice/live-session${query}`);
    } catch (error) {
      fail(error instanceof Error ? serverErrorMessage(error) : MIC_FAILED);
      return;
    }
    if (!mountedRef.current) return;
    try {
      if (session.mode === 'live' && liveDictationSupported()) await dictateLive(session);
      else await recordClip();
    } catch (error) {
      fail(captureErrorMessage(error));
    }
  };

  const stop = () => {
    const capture = captureRef.current;
    if (!capture) return;
    setPhase('finishing');
    capture.stop();
  };

  const state: VoiceDictationState =
    phase === 'finishing' || (phase === 'idle' && transcribe.isPending) ? 'transcribing' : phase;
  return { state, start, stop };
}
