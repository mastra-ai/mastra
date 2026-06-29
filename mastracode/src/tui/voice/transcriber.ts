export type TranscriptEvent =
  | { type: 'partial'; text: string; level?: number }
  | { type: 'final'; text: string }
  | { type: 'error'; message: string };

export interface StreamingTranscriber {
  start(): AsyncIterable<TranscriptEvent>;
  stop(): Promise<void> | void;
}

export type StreamingTranscriberFactory = () => StreamingTranscriber;
