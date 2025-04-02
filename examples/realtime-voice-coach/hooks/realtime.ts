import { connectToOpenAIRealtime, Tool } from '@/lib/realtime';
import { useState } from 'react';

export function useRealtimeState() {
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [model, setModel] = useState('gpt-4o-realtime-preview-2024-12-17');
  const [voice, setVoice] = useState('verse');
  const [error, setError] = useState<string | null>(null);

  return {
    connectionState,
    setConnectionState,
    error,
    setError,
    model,
    setModel,
    voice,
    setVoice,
  };
}

export function useRealtimeSession() {
  const { connectionState, setConnectionState, setError, model, voice } = useRealtimeState();

  const createSession = async ({
    initialMessage,
    instructions,
    tools,
  }: {
    instructions: string;
    initialMessage: string;
    tools: Tool<any>[];
  }) => {
    try {
      setConnectionState('pending');

      await connectToOpenAIRealtime({
        model,
        voice,
        tools,
        instructions,
        initialMessage,
      });

      setConnectionState('connected');
    } catch (error) {
      console.error(error);
      setError((error as Error).message);
      setConnectionState('error');
    }
  };

  return {
    connectionState,
    createSession,
  };
}
