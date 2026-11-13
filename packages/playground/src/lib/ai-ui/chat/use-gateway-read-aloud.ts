import { speakGatewayAudio } from '@mastra/playground-ui/utils/gateway-audio';
import { useReadAloud } from '@mastra/react/hooks/voice';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type ReadAloudArgs = Parameters<typeof useReadAloud>;

/** Adds deployment Gateway playback to the existing agent/browser read-aloud hook. */
export function useGatewayReadAloud(
  agentId?: ReadAloudArgs[0],
  requestContext?: ReadAloudArgs[1],
  gatewaySpeech?: { baseUrl: string; model: string; voice: string },
) {
  const fallback = useReadAloud(agentId, requestContext, {
    onError: error => toast.error(error instanceof Error ? error.message : 'Voice generation failed.'),
  });
  const [isGatewaySpeaking, setIsGatewaySpeaking] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const playbackVersionRef = useRef(0);

  const stopGateway = () => {
    playbackVersionRef.current += 1;
    cleanupRef.current?.();
    cleanupRef.current = null;
    setIsGatewaySpeaking(false);
  };

  const stop = () => {
    stopGateway();
    fallback.stop();
  };

  const readAloud = async (text: string) => {
    if (!text) return;
    stop();
    if (!gatewaySpeech) {
      await fallback.readAloud(text);
      return;
    }

    const playbackVersion = playbackVersionRef.current;
    setIsGatewaySpeaking(true);
    try {
      const blob = await speakGatewayAudio(gatewaySpeech.baseUrl, gatewaySpeech.model, gatewaySpeech.voice, text);
      if (playbackVersion !== playbackVersionRef.current) return;
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      const cleanup = () => {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        URL.revokeObjectURL(url);
        if (playbackVersion === playbackVersionRef.current) setIsGatewaySpeaking(false);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      cleanupRef.current = cleanup;
      await audio.play();
    } catch (error) {
      if (playbackVersion !== playbackVersionRef.current) return;
      stopGateway();
      toast.error(error instanceof Error ? error.message : 'Gateway speech failed.');
    }
  };

  useEffect(
    () => () => {
      playbackVersionRef.current += 1;
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    [],
  );

  return { isSpeaking: isGatewaySpeaking || fallback.isSpeaking, readAloud, stop };
}
