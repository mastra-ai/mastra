import type { SpeechSynthesisAdapter } from '@assistant-ui/react';
import type { Agent } from '@mastra/core/agent';
import { playStreamWithWebAudio } from '@mastra/react';
import { toast } from 'sonner';

/**
 * Turns a failed `voice.speak()` call into a message that points the user at the
 * likely cause. Voice generation runs against the agent's configured provider
 * (e.g. OpenAI), so the common failures are auth/quota/missing-provider issues
 * that the user can only fix in their own setup.
 */
function describeSpeakError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  const body = (error as { body?: { error?: string } } | null)?.body;
  const detail = body?.error ?? (error instanceof Error ? error.message : undefined);

  if (status === 429) {
    return 'Voice provider quota exceeded. Check your voice provider plan and billing, or use an API key with available credits.';
  }

  if (detail) {
    return `Voice generation failed: ${detail}`;
  }

  return 'Voice generation failed.';
}

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

      if (reason === 'error') {
        console.error('Voice playback failed', error);
        toast.error(describeSpeakError(error));
      }

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
