import { useMastraClient, playStreamWithWebAudio } from '@mastra/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ClientAgent = ReturnType<ReturnType<typeof useMastraClient>['getAgent']>;
type VoiceRequestContext = Parameters<ClientAgent['voice']['getSpeakers']>[0];

/**
 * Read-aloud (text-to-speech) for assistant messages, replacing the assistant-ui
 * speech adapters (`VoiceAttachmentAdapter` / `WebSpeechSynthesisAdapter`).
 *
 * Prefers the agent's configured voice provider when it exposes speakers,
 * streaming the audio through Web Audio. Falls back to the browser
 * `speechSynthesis` API otherwise.
 */
export const useReadAloud = (agentId?: string, requestContext?: VoiceRequestContext) => {
  const client = useMastraClient();
  const [hasAgentVoice, setHasAgentVoice] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!agentId) {
      setHasAgentVoice(false);
      return () => {
        cancelled = true;
      };
    }
    const agent = client.getAgent(agentId);
    void agent.voice
      .getSpeakers(requestContext)
      .then(speakers => {
        if (!cancelled) setHasAgentVoice(speakers.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasAgentVoice(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, client, requestContext]);

  const stop = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const readAloud = useCallback(
    async (text: string) => {
      if (!text) return;
      stop();
      setIsSpeaking(true);

      if (agentId && hasAgentVoice) {
        try {
          const agent = client.getAgent(agentId);
          const response = (await agent.voice.speak(text)) as unknown as { body?: ReadableStream };
          if (!response.body) {
            throw new Error('No audio stream returned from voice.speak()');
          }
          const cleanup = await playStreamWithWebAudio(response.body, () => setIsSpeaking(false));
          cleanupRef.current = cleanup ?? null;
          return;
        } catch (error) {
          setIsSpeaking(false);
          toast.error(error instanceof Error ? error.message : 'Voice generation failed.');
          return;
        }
      }

      if (typeof window !== 'undefined' && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
        return;
      }

      setIsSpeaking(false);
    },
    [agentId, client, hasAgentVoice, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { isSpeaking, readAloud, stop };
};
