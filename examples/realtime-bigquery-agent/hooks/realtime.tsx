import { MastraClient, RealtimeClientConnectOptions } from '@mastra/client-js';
import { useState } from 'react';

const mastra = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

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

  async function createSession({
    initialMessage,
    instructions,
    browserTools,
    ...rest
  }: Omit<RealtimeClientConnectOptions, 'model' | 'voice'>) {
    try {
      setConnectionState('pending');

      await mastra.createRealtimeConnection({
        model,
        voice,
        instructions,
        initialMessage,
        browserTools,
        ...rest,
      });

      setConnectionState('connected');
    } catch (error) {
      console.error(error);
      setError((error as Error).message);
      setConnectionState('error');
    }
  }

  return {
    connectionState,
    createSession,
  };
}
