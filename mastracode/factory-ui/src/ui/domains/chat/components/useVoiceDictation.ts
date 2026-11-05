import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import type { TranscribeResponse } from '../../../../api/types';

type RecordingPhase = 'idle' | 'requesting' | 'recording';
export type VoiceDictationState = RecordingPhase | 'transcribing';

/** Browsers without `MediaRecorder` (or an insecure origin) cannot dictate. */
export function voiceDictationSupported(): boolean {
  return typeof window.MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

const MIC_BLOCKED = 'Microphone access was blocked. Allow it in your browser to use voice input.';
const MIC_ERRORS: Record<string, string> = {
  NotAllowedError: MIC_BLOCKED,
  SecurityError: MIC_BLOCKED,
  NotFoundError: 'No microphone found. Connect one to use voice input.',
  NotReadableError: 'Your microphone is busy in another app. Close it and try again.',
};
const MIC_FAILED = 'Could not start the microphone. Try again.';

function micErrorMessage(error: unknown): string {
  return (error instanceof DOMException && MIC_ERRORS[error.name]) || MIC_FAILED;
}

function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach(track => track.stop());
}

/** Records a mic clip and transcribes it server-side, so provider keys never reach the browser. */
export function useVoiceDictation({
  factoryId,
  onTranscript,
  onError,
}: {
  factoryId: string;
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
}) {
  const { client } = useApiConfig();
  const [phase, setPhase] = useState<RecordingPhase>('idle');
  const recorderRef = useRef<MediaRecorder>(undefined);
  const mountedRef = useRef(true);

  const transcribe = useMutation({
    mutationFn: (clip: Blob) =>
      client.post<TranscribeResponse>(`/web/voice/transcribe?factoryId=${encodeURIComponent(factoryId)}`, clip),
    onSuccess: ({ text }) => {
      if (text) onTranscript(text);
      else onError('No speech detected.');
    },
    onError: error => onError(error.message),
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const recorder = recorderRef.current;
      if (!recorder) return;
      recorder.ondataavailable = null;
      recorder.onstop = null;
      if (recorder.state !== 'inactive') recorder.stop();
      stopTracks(recorder.stream);
    };
  }, []);

  const startRecorder = (stream: MediaStream) => {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = event => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      stopTracks(recorder.stream);
      recorderRef.current = undefined;
      setPhase('idle');
      const clip = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (clip.size > 0) transcribe.mutate(clip);
    };
    recorder.start();
    return recorder;
  };

  const start = async () => {
    setPhase('requesting');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      setPhase('idle');
      onError(micErrorMessage(error));
      return;
    }
    if (!mountedRef.current) {
      stopTracks(stream);
      return;
    }
    try {
      recorderRef.current = startRecorder(stream);
      setPhase('recording');
    } catch {
      stopTracks(stream);
      setPhase('idle');
      onError('This browser could not start recording. Try again or use another browser.');
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  const state: VoiceDictationState = phase === 'idle' && transcribe.isPending ? 'transcribing' : phase;
  return { state, start, stop };
}
