import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { useApiConfig } from '../../../../api/config';

export type VoiceDictationState = 'idle' | 'requesting' | 'recording' | 'transcribing';

interface TranscribeResponse {
  text: string;
  provider: string;
  model: string;
}

/** Browsers without `MediaRecorder` (or an insecure origin) cannot dictate. */
export function voiceDictationSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

function dictationState(requesting: boolean, recording: boolean, transcribing: boolean): VoiceDictationState {
  if (requesting) return 'requesting';
  if (recording) return 'recording';
  if (transcribing) return 'transcribing';
  return 'idle';
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read recording'));
    reader.readAsDataURL(blob);
  });
}

const MIC_BLOCKED = 'Microphone access was blocked. Allow it in your browser to use voice input.';
const MIC_ERRORS: Record<string, string> = {
  NotFoundError: 'No microphone found. Connect one to use voice input.',
  NotReadableError: 'Your microphone is busy in another app. Close it and try again.',
};

function micErrorMessage(error: unknown): string {
  return (error instanceof DOMException && MIC_ERRORS[error.name]) || MIC_BLOCKED;
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
  const [requesting, setRequesting] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder>(undefined);
  const mountedRef = useRef(true);

  const transcribe = useMutation({
    mutationFn: async (clip: Blob) =>
      client.post<TranscribeResponse>('/web/voice/transcribe', {
        audio: await blobToBase64(clip),
        mimeType: clip.type || 'audio/webm',
        factoryId,
      }),
    onSuccess: ({ text }) => {
      if (text) onTranscript(text);
      else onError('No speech detected.');
    },
    onError: error => onError(error.message),
  });

  const stopTracks = (stream: MediaStream) => stream.getTracks().forEach(track => track.stop());

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
      setRecording(false);
      const clip = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
      if (clip.size > 0) transcribe.mutate(clip);
    };
    recorder.start();
    return recorder;
  };

  const start = async () => {
    setRequesting(true);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      onError(micErrorMessage(error));
      return;
    } finally {
      setRequesting(false);
    }
    if (!mountedRef.current) {
      stopTracks(stream);
      return;
    }
    try {
      recorderRef.current = startRecorder(stream);
      setRecording(true);
    } catch {
      stopTracks(stream);
      onError('This browser could not start recording. Try again or use another browser.');
    }
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  return { state: dictationState(requesting, recording, transcribe.isPending), start, stop };
}
