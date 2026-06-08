import type { SpeechSynthesisAdapter } from '@assistant-ui/react';
import type { Agent } from '@mastra/core/agent';
import { playStreamWithWebAudio } from '@mastra/react';

export class VoiceAttachmentAdapter implements SpeechSynthesisAdapter {
  constructor(private readonly agent: Agent) {}

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    const subscribers = new Set<() => void>();
    let cleanup = () => {};
    let started = false;

    const notify = () => {
      subscribers.forEach(callback => callback());
    };

    const handleEnd = (reason: 'finished' | 'error' | 'cancelled', error?: unknown) => {
      if (res.status.type === 'ended') return;

      res.status = { type: 'ended', reason, error };
      cleanup();
      notify();
    };

    const start = () => {
      if (started) return;

      started = true;

      this.agent.voice
        .speak(text)
        .then(response => {
          if (res.status.type === 'ended') return undefined;
          return (response as unknown as { body?: ReadableStream }).body;
        })
        .then(readableStream => {
          if (res.status.type === 'ended') return undefined;
          if (!readableStream) {
            handleEnd('error', new Error('No audio stream returned from voice.speak()'));
            return undefined;
          }
          return playStreamWithWebAudio(readableStream, () => handleEnd('finished'));
        })
        .then(nextCleanup => {
          if (res.status.type === 'ended') {
            nextCleanup?.();
            return;
          }

          if (nextCleanup) {
            cleanup = nextCleanup;
          }
        })
        .catch(error => {
          handleEnd('error', error);
        });
    };

    const res: SpeechSynthesisAdapter.Utterance = {
      status: { type: 'running' },
      cancel: () => {
        handleEnd('cancelled');
      },
      subscribe: callback => {
        subscribers.add(callback);
        start();
        callback();

        return () => {
          subscribers.delete(callback);
        };
      },
    };

    return res;
  }
}
