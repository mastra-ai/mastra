import { SpeechSynthesisAdapter } from '@assistant-ui/react';
import { Agent } from '@mastra/core/agent';

export class VoiceAttachmentAdapter implements SpeechSynthesisAdapter {
  constructor(private readonly agent: Agent) {}
  speak(text: string): SpeechSynthesisAdapter.Utterance {
    let _cleanup = () => {};

    const handleEnd = (reason: 'finished' | 'error' | 'cancelled', error?: unknown) => {
      if (res.status.type === 'ended') return;

      res.status = { type: 'ended', reason, error };

      _cleanup();
    };

    const res: SpeechSynthesisAdapter.Utterance = {
      status: { type: 'running' },
      cancel: () => {
        handleEnd('cancelled');
      },
      subscribe: callback => {
        this.agent.voice
          .speak(text)
          .then(res => {
            if (res) {
              return (res as unknown as { body: ReadableStream }).body;
            }
          })
          .then(readableStream => {
            if (readableStream) {
              return playStreamWithWebAudio(readableStream);
            }
          })
          .then(cleanup => {
            if (cleanup) {
              _cleanup = cleanup;
            }

            callback();
          })
          .catch(error => {
            handleEnd('error', error);
          });

        return () => {};
      },
    };
    return res;
  }
}

async function playStreamWithWebAudio(stream: ReadableStream) {
  const audioContext = new window.AudioContext();

  const reader = stream.getReader();
  const chunks = [];

  // Read all chunks
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks into single ArrayBuffer
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const combinedBuffer = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    combinedBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  // Decode and play
  const audioBuffer = await audioContext.decodeAudioData(combinedBuffer.buffer);
  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);
  source.start();

  return () => {
    source.stop();
    audioContext.close();
  };
}
