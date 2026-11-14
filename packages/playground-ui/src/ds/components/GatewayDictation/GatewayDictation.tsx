import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { transcribeGatewayAudio } from '../../../utils/gateway-audio';
import { Button } from '../Button';
import { toast } from '../Toaster';

interface GatewayDictationProps {
  baseUrl: string;
  model?: string;
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

function recordingFormat(): { mimeType: string; extension: string } | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const option of [
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/ogg', extension: 'ogg' },
  ]) {
    if (MediaRecorder.isTypeSupported(option.mimeType)) return option;
  }
  return undefined;
}

/** Records one utterance, then inserts its Gateway transcript into the composer. */
export function GatewayDictation({ baseUrl, model, onTranscript, disabled }: GatewayDictationProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const format = recordingFormat();

  useEffect(
    () => () => {
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach(track => track.stop());
    },
    [],
  );

  if (!model || !format || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;

  const toggle = async () => {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType: format.mimeType });
      const chunks: BlobPart[] = [];
      recorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        recorderRef.current = null;
        streamRef.current = null;
        const audio = new Blob(chunks, { type: format.mimeType });
        if (!audio.size) {
          toast.error('No audio was recorded.');
          return;
        }
        setTranscribing(true);
        void transcribeGatewayAudio(baseUrl, model, audio, format.extension)
          .then(onTranscript)
          .catch(error => toast.error(error instanceof Error ? error.message : 'Could not transcribe audio.'))
          .finally(() => setTranscribing(false));
      };
      recorder.start();
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      toast.error('Microphone access is unavailable.');
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-md"
      aria-label={recording ? 'Stop dictation' : 'Start dictation'}
      disabled={disabled || transcribing}
      onClick={() => void toggle()}
    >
      {recording ? <Square size={16} /> : <Mic size={16} />}
    </Button>
  );
}
