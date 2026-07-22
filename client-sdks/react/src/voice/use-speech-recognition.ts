import type { MastraClient } from '@mastra/client-js';
import { useEffect, useRef, useState } from 'react';
import { useMastraClient } from '../mastra-client-context';
import { recordMicrophoneToFile } from './record-mic-to-file';

type Agent = ReturnType<MastraClient['getAgent']>;
type VoiceRequestContext = Parameters<Agent['voice']['getSpeakers']>[0];

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface UseSpeechRecognitionArgs {
  language?: string;
  agentId?: string;
  requestContext?: VoiceRequestContext;
}

type SpeechRecognitionResult = SpeechRecognitionState & {
  start: () => void;
  stop: () => void;
};

export const useSpeechRecognition = ({
  language = 'en-US',
  agentId,
  requestContext,
}: UseSpeechRecognitionArgs): SpeechRecognitionResult => {
  const client = useMastraClient();
  const [agent, setAgent] = useState<Agent | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!agentId) {
      setAgent(null);
      return () => {
        cancelled = true;
      };
    }

    const agent = client.getAgent(agentId);

    const check = async () => {
      try {
        const speakers = await agent.voice.getSpeakers(requestContext);
        if (!cancelled) {
          setAgent(speakers.length > 0 ? agent : null);
        }
      } catch {
        if (!cancelled) {
          setAgent(null);
        }
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [agentId, client, requestContext]);

  const browserSpeechRecognition = useBrowserSpeechRecognition({ language });
  const mastraSpeechRecognition = useMastraSpeechToText({ agent, language });

  if (!agent) {
    return browserSpeechRecognition;
  }

  return mastraSpeechRecognition;
};

const useBrowserSpeechRecognition = ({ language = 'en-US' }: { language?: string }): SpeechRecognitionResult => {
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

    recognition.continuous = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null }));
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

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore: recognition may not be running
      }
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      speechRecognitionRef.current = null;
    };
  }, [language]);

  return {
    ...state,
    start,
    stop,
  };
};

const useMastraSpeechToText = ({
  agent,
  language,
}: {
  agent: Agent | null;
  language: string;
}): SpeechRecognitionResult => {
  const [state, setState] = useState<SpeechRecognitionState>({
    isListening: false,
    transcript: '',
    error: null,
  });
  const recorderRef = useRef<MediaRecorder | null>(null);
  const sessionRef = useRef(0);
  const startInFlightRef = useRef(false);

  useEffect(() => {
    return () => {
      sessionRef.current += 1;
      startInFlightRef.current = false;
      recorderRef.current?.stop();
      recorderRef.current = null;
    };
  }, [agent]);

  const handleFinish = (session: number) => (file: File) => {
    if (!agent || session !== sessionRef.current) return;

    recorderRef.current = null;
    setState(prev => ({ ...prev, isListening: false }));

    void agent.voice
      .listen(file, { language })
      .then(res => {
        if (session !== sessionRef.current) return;
        setState(prev => ({ ...prev, transcript: res.text, error: null }));
      })
      .catch(error => {
        if (session !== sessionRef.current) return;
        const message = error instanceof Error ? error.message : 'Failed to transcribe speech';
        setState(prev => ({ ...prev, error: message }));
      });
  };

  const start = () => {
    if (!agent || startInFlightRef.current || recorderRef.current) return;

    startInFlightRef.current = true;
    // Bump the session here (not in stop()) so a normal stop's onstop callback
    // still matches sessionRef.current. Only a new start (or unmount) should
    // invalidate a prior in-flight recording's result.
    // See: https://github.com/mastra-ai/mastra/issues/19980
    sessionRef.current += 1;
    const session = sessionRef.current;

    void recordMicrophoneToFile(handleFinish(session))
      .then(recorder => {
        startInFlightRef.current = false;
        if (session !== sessionRef.current) {
          try {
            recorder.stop();
          } catch {
            // ignore: recorder was never started
          }
          return;
        }
        recorderRef.current = recorder;
        setState(prev => ({ ...prev, isListening: true, error: null }));
        recorder.start();
      })
      .catch(error => {
        startInFlightRef.current = false;
        if (session !== sessionRef.current) return;
        const message = error instanceof Error ? error.message : 'Failed to start speech recording';
        setState(prev => ({ ...prev, isListening: false, error: message }));
      });
  };

  const stop = () => {
    startInFlightRef.current = false;
    if (recorderRef.current) {
      // An active recording — its session was fixed at start() time and hasn't
      // changed, so its own onstop/handleFinish will complete normally.
      recorderRef.current.stop();
      recorderRef.current = null;
    } else {
      // No recorder yet: a start() is still in-flight. Invalidate the session
      // so that in-flight start's resolution knows to abort (stop the recorder
      // instead of assigning/starting it) rather than silently proceeding.
      sessionRef.current += 1;
    }
    setState(prev => ({ ...prev, isListening: false }));
  };

  return {
    ...state,
    start,
    stop,
  };
};
