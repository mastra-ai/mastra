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

/**
 * Records a clip from the microphone and transcribes it server-side with the
 * caller's own speech-to-text key. Each finished transcript is handed to
 * `onTranscript`; failures (mic denied, no key, provider error) go to `onError`.
 */
export function useVoiceDictation({
  factoryId,
  onTranscript,
  onError,
}: {
  /** Factory whose model scope and voice model apply; omitted outside a Factory. */
  factoryId?: string;
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
        ...(factoryId ? { factoryId } : {}),
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

  const start = async () => {
    setRequesting(true);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError('Microphone access was blocked. Allow it in your browser to use voice input.');
      return;
    } finally {
      setRequesting(false);
    }
    if (!mountedRef.current) {
      stopTracks(stream);
      return;
    }
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
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stop = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };

  return { state: dictationState(requesting, recording, transcribe.isPending), start, stop };
}
