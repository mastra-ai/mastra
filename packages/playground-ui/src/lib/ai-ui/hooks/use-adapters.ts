import { Agent } from '@mastra/core/agent';
import { useMastraClient } from '@mastra/react';
import { useEffect, useState } from 'react';
import { VoiceAttachmentAdapter } from '../attachments/voice-adapter';
import {
  CompositeAttachmentAdapter,
  SimpleImageAttachmentAdapter,
  SimpleTextAttachmentAdapter,
  SpeechSynthesisAdapter,
  WebSpeechSynthesisAdapter,
} from '@assistant-ui/react';
import { PDFAttachmentAdapter } from '../attachments/pdfs-adapter';
import { usePlaygroundStore } from '@/store/playground-store';

export const useAdapters = (agentId: string) => {
  const [isReady, setIsReady] = useState(false);
  const [speechAdapter, setSpeechAdapter] = useState<SpeechSynthesisAdapter | undefined>(undefined);
  const baseClient = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  useEffect(() => {
    const check = async () => {
      const agent = baseClient.getAgent(agentId);

      try {
        const speakers = await agent.voice.getSpeakers(requestContext);
        if (speakers.length > 0) {
          setSpeechAdapter(new VoiceAttachmentAdapter(agent as unknown as Agent));
        } else {
          setSpeechAdapter(new WebSpeechSynthesisAdapter());
        }
        setIsReady(true);
      } catch {
        setSpeechAdapter(new WebSpeechSynthesisAdapter());
        setIsReady(true);
      }
    };

    check();
  }, [agentId]);

  return {
    isReady,
    adapters: {
      attachments: new CompositeAttachmentAdapter([
        new SimpleImageAttachmentAdapter(),
        new SimpleTextAttachmentAdapter(),
        new PDFAttachmentAdapter(),
      ]),
      speech: speechAdapter,
    },
  };
};
