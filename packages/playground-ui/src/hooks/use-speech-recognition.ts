import { useEffect, useRef, useState } from 'react';

export interface SpeechRecognitionState {
  isListening: boolean;
  transcript: string;
  error: string | null;
}

export interface UseSpeechRecognitionArgs {
  language?: string;
}

export const useSpeechRecognition = ({ language = 'en-US' }: UseSpeechRecognitionArgs = {}) => {
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
