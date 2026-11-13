import { Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { transcribeGatewayAudio } from '../../../utils/gateway-audio';
import { Button } from '../Button';

interface GatewayDictationProps {
  baseUrl: string;
  models: readonly { id: string }[];
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
export function GatewayDictation({ baseUrl, models, onTranscript, disabled }: GatewayDictationProps) {
  const [selectedModel, setSelectedModel] = useState<string>();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string>();
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const model = models.some(item => item.id === selectedModel) ? selectedModel : models[0]?.id;
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
    setError(undefined);
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
          setError('No audio was recorded.');
          return;
        }
        setTranscribing(true);
        void transcribeGatewayAudio(baseUrl, model, audio, format.extension)
          .then(onTranscript)
          .catch(() => setError('Could not transcribe audio.'))
          .finally(() => setTranscribing(false));
      };
      recorder.start();
      setRecording(true);
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setError('Microphone access is unavailable.');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="Transcription model"
        className="max-w-28"
        value={model}
        onChange={event => setSelectedModel(event.target.value)}
        disabled={disabled || recording || transcribing}
      >
        {models.map(item => (
          <option key={item.id} value={item.id}>
            {item.id}
          </option>
        ))}
      </select>
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
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
