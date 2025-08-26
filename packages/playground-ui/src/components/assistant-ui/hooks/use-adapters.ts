import { Agent } from '@mastra/core/agent';
import { useMastraClient } from '@/contexts/mastra-client-context';
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

export const useAdapters = (agentId: string) => {
  const [isReady, setIsReady] = useState(false);
  const [speechAdapter, setSpeechAdapter] = useState<SpeechSynthesisAdapter | undefined>(undefined);
  const baseClient = useMastraClient();

  useEffect(() => {
    const check = async () => {
      const agent = baseClient.getAgent(agentId);

      try {
        await agent.voice.getSpeakers();
        setSpeechAdapter(new VoiceAttachmentAdapter(agent as unknown as Agent));
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
