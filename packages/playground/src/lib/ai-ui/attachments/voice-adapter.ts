import type { SpeechSynthesisAdapter } from '@assistant-ui/react';
import type { Agent } from '@mastra/core/agent';
import { playStreamWithWebAudio } from '@mastra/react';

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
