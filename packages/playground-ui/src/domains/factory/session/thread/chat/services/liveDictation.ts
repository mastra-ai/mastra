import { z } from 'zod';

import { createPcmEncoder } from './voicePcm';

const CAPTURE_PROCESSOR = 'factory-pcm-capture';
const CAPTURE_WORKLET = `registerProcessor('${CAPTURE_PROCESSOR}', class extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
});`;

const CONNECT_TIMEOUT_MS = 10_000;
const FINISH_TIMEOUT_MS = 10_000;

const COULD_NOT_CONNECT = 'Live transcription could not connect. Try again.';
const CONNECTION_LOST = 'Live transcription stopped unexpectedly. Try again.';
const LIVE_FAILED = 'Live transcription failed. Try again.';
const AUDIO_FAILED = 'This browser could not capture audio for live transcription. Try again or use another browser.';

const realtimeEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('session.created') }),
  z.object({ type: z.literal('transcription.text.delta'), text: z.string() }),
  z.object({ type: z.literal('transcription.done'), text: z.string() }),
  z.object({ type: z.literal('error'), error: z.unknown() }),
]);

type RealtimeEvent = z.infer<typeof realtimeEventSchema>;

function parseRealtimeEvent(data: unknown): RealtimeEvent | undefined {
  if (typeof data !== 'string') return undefined;
  try {
    const parsed = realtimeEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export type LiveDictationOutcome = { transcript: string } | { transcript: string; error: string };

export interface LiveDictation {
  finished: Promise<LiveDictationOutcome>;
  stop(): void;
  cancel(): void;
}

export interface LiveDictationSession {
  url: string;
  token: string;
}

export function liveDictationSupported(): boolean {
  return typeof AudioWorkletNode !== 'undefined' && typeof WebSocket !== 'undefined';
}

export function startLiveDictation({
  session,
  stream,
  onText,
}: {
  session: LiveDictationSession;
  stream: MediaStream;
  onText: (transcript: string) => void;
}): LiveDictation {
  let transcript = '';
  let configured = false;
  let ending = false;
  let settled = false;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let capture: { source: MediaStreamAudioSourceNode; node: AudioWorkletNode } | undefined;
  const pendingAudio: string[] = [];
  let resolveFinished: (outcome: LiveDictationOutcome) => void = () => {};
  const finished = new Promise<LiveDictationOutcome>(resolve => {
    resolveFinished = resolve;
  });

  const context = new AudioContext();
  const encoder = createPcmEncoder(context.sampleRate);
  let socket: WebSocket;
  try {
    socket = new WebSocket(session.url, ['realtime', session.token]);
  } catch (error) {
    void context.close().catch(() => undefined);
    throw error;
  }

  const send = (event: Record<string, unknown>) => socket.send(JSON.stringify(event));
  const sendAudio = (audio: string) => {
    if (configured) send({ type: 'input_audio.append', audio });
    else pendingAudio.push(audio);
  };

  const releaseAudio = () => {
    stream.getTracks().forEach(track => track.stop());
    if (capture) {
      capture.node.port.onmessage = null;
      capture.source.disconnect();
      capture.node.disconnect();
      capture = undefined;
    }
    if (context.state !== 'closed') void context.close().catch(() => undefined);
  };

  const finish = (outcome: LiveDictationOutcome) => {
    if (settled) return;
    settled = true;
    clearTimeout(connectTimer);
    clearTimeout(finishTimer);
    releaseAudio();
    socket.onmessage = null;
    socket.onclose = null;
    socket.onerror = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close(1000);
    resolveFinished(outcome);
  };

  socket.onmessage = event => {
    const message = parseRealtimeEvent(event.data);
    if (!message) return;
    if (message.type === 'session.created') {
      clearTimeout(connectTimer);
      send({
        type: 'session.update',
        session: { audio_format: { encoding: 'pcm_s16le', sample_rate: encoder.sampleRate } },
      });
      configured = true;
      for (const audio of pendingAudio.splice(0)) sendAudio(audio);
      if (ending) send({ type: 'input_audio.end' });
    } else if (message.type === 'transcription.text.delta') {
      transcript += message.text;
      onText(transcript);
    } else if (message.type === 'transcription.done') {
      finish({ transcript: message.text || transcript });
    } else {
      console.warn('[voice] live transcription error', message.error);
      finish({ transcript, error: LIVE_FAILED });
    }
  };
  socket.onclose = () => {
    if (!configured) finish({ transcript, error: COULD_NOT_CONNECT });
    else finish(ending ? { transcript } : { transcript, error: CONNECTION_LOST });
  };
  const connectTimer = setTimeout(() => finish({ transcript, error: COULD_NOT_CONNECT }), CONNECT_TIMEOUT_MS);

  const startCapture = async () => {
    const moduleUrl = URL.createObjectURL(new Blob([CAPTURE_WORKLET], { type: 'text/javascript' }));
    try {
      await context.audioWorklet.addModule(moduleUrl);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
    if (settled || ending) return;
    const source = context.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(context, CAPTURE_PROCESSOR);
    node.port.onmessage = (event: MessageEvent<unknown>) => {
      if (!(event.data instanceof Float32Array)) return;
      for (const audio of encoder.push(event.data)) sendAudio(audio);
    };
    source.connect(node);
    node.connect(context.destination);
    capture = { source, node };
    if (context.state === 'suspended') void context.resume().catch(() => undefined);
  };
  startCapture().catch(() => finish({ transcript, error: AUDIO_FAILED }));

  return {
    finished,
    stop() {
      if (settled || ending) return;
      ending = true;
      const rest = encoder.flush();
      if (rest) sendAudio(rest);
      releaseAudio();
      if (configured) send({ type: 'input_audio.end' });
      finishTimer = setTimeout(() => finish({ transcript }), FINISH_TIMEOUT_MS);
    },
    cancel() {
      finish({ transcript });
    },
  };
}
