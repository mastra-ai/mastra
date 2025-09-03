import { useMastraClient } from '@/contexts/mastra-client-context';
import { Agent } from '@mastra/core/agent';
import { useEffect, useRef, useState } from 'react';
import { recordMicrophoneToFile } from '../utils/record-mic-to-file';

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface UseSpeechRecognitionArgs {
  language?: string;
  agentId?: string;
}

type BrowserSpeechRecognition = {
  start: () => void;
  stop: () => void;
  isListening: boolean;
  transcript: string;
};

export const useSpeechRecognition = ({
  language = 'en-US',
  agentId,
}: UseSpeechRecognitionArgs): BrowserSpeechRecognition => {
  const client = useMastraClient();
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    if (!agentId) return;

    const agent = client.getAgent(agentId);

    const check = async () => {
      try {
        await agent.voice.getSpeakers();
        setAgent(agent as unknown as Agent);
      } catch (error) {
        setAgent(null);
      }
    };

    check();
  }, [agentId]);

  const {
    start: startBrowser,
    stop: stopBrowser,
    isListening: isListeningBrowser,
    transcript: transcriptBrowser,
  } = useBrowserSpeechRecognition({ language });

  const {
    start: startMastra,
    stop: stopMastra,
    isListening: isListeningMastra,
    transcript: transcriptMastra,
  } = useMastraSpeechToText({ agent });

  if (!agent) {
    return {
      start: startBrowser,
      stop: stopBrowser,
      isListening: isListeningBrowser,
      transcript: transcriptBrowser,
    };
  }

  return { start: startMastra, stop: stopMastra, isListening: isListeningMastra, transcript: transcriptMastra };
};

const useBrowserSpeechRecognition = ({ language = 'en-US' }: { language?: string }) => {
  const speechRecognitionRef = useRef<any>(null);
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    error: null,
  });

  const start = () => {
    if (!speechRecognitionRef.current) return;
    speechRecognitionRef.current.start();
  };

  const stop = () => {
    if (!speechRecognitionRef.current) return;
    speechRecognitionRef.current.stop();
  };

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setState(prev => ({ ...prev, error: 'Speech Recognition not supported in this browser' }));
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    speechRecognitionRef.current = recognition;

    // Configuration
    recognition.continuous = true; // Keep listening
    recognition.lang = language; // Language

    // Event handlers
    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true }));
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
        }
      }

      setState(prev => ({ ...prev, transcript: finalTranscript }));
    };

    recognition.onerror = (event: any) => {
      setState(prev => ({ ...prev, error: `Error: ${event.error}` }));
    };

    recognition.onend = () => setState(prev => ({ ...prev, isListening: false }));
  }, [language]);

  return {
    ...state,
    start,
    stop,
  };
};

const useMastraSpeechToText = ({ agent }: { agent: Agent | null }) => {
  const [transcript, setTranscript] = useState('');
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);

  if (!agent) {
    return {
      start: () => {},
      stop: () => {},
      isListening: false,
      transcript: '',
    };
  }

  const handleFinish = (file: File) => {
    agent.voice.listen(file as any).then(res => {
      setTranscript((res as unknown as { text: string }).text);
    });
  };

  const start = () => {
    recordMicrophoneToFile(handleFinish).then(recorder => {
      setRecorder(recorder);
      recorder.start();
    });
  };

  const stop = () => {
    recorder?.stop();
    setRecorder(null);
  };

  return {
    start,
    stop,
    isListening: Boolean(recorder),
    transcript,
  };
};
