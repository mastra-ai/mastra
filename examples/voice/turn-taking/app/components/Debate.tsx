'use client';

import { useState, useRef } from 'react';
import { mastraClient } from '@/lib/mastra-client';

export default function DebateInterface() {
  const [topic, setTopic] = useState('');
  const [turns, setTurns] = useState(3);
  const [isDebating, setIsDebating] = useState(false);
  const [responses, setResponses] = useState<any[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Function to start the debate
  const startDebate = async () => {
    if (!topic) return;

    setIsDebating(true);
    setResponses([]);

    try {
      const optimist = mastraClient.getAgent('optimistAgent');
      const skeptic = mastraClient.getAgent('skepticAgent');

      const newResponses = [];
      let optimistResponse = '';
      let skepticResponse = '';

      for (let turn = 1; turn <= turns; turn++) {
        // Optimist's turn
        let prompt;
        if (turn === 1) {
          prompt = `Discuss this topic: ${topic}. Introduce your perspective on it.`;
        } else {
          prompt = `The topic is: ${topic}. Skeptic just said: "${skepticResponse}". Respond to their points.`;
        }

        const optimistResult = await optimist.generate({
          messages: [{ role: 'user', content: prompt }],
        });

        optimistResponse = optimistResult.text;
        newResponses.push({
          agent: 'Optimist',
          text: optimistResponse,
        });

        // Update UI after each response
        setResponses([...newResponses]);

        // Skeptic's turn
        prompt = `The topic is: ${topic}. Optimist just said: "${optimistResponse}". Respond to their points.`;

        const skepticResult = await skeptic.generate({
          messages: [{ role: 'user', content: prompt }],
        });

        skepticResponse = skepticResult.text;
        newResponses.push({
          agent: 'Skeptic',
          text: skepticResponse,
        });

        // Update UI after each response
        setResponses([...newResponses]);
      }
    } catch (error) {
      console.error('Error starting debate:', error);
    } finally {
      setIsDebating(false);
    }
  };

  // Function to play audio for a specific response
  const playAudio = async (text: string, agent: string) => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);
      const agentClient = mastraClient.getAgent(agent === 'Optimist' ? 'optimistAgent' : 'skepticAgent');

      const audioResponse = await agentClient.voice.speak(text, {
        speaker: agent === 'Optimist' ? 'alloy' : 'echo',
        speakerId: agent === 'Optimist' ? 'alloy' : 'echo',
      });

      if (!audioResponse.body) {
        throw new Error('No audio stream received');
      }

      const blob = await readStream(audioResponse.body);
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        console.log('Playing audio:', url);
        audioRef.current.src = url;
        audioRef.current.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
        };
        audioRef.current.onerror = error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        };
        audioRef.current.play();
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      setIsPlaying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI Debate with Turn Taking</h1>

      <div className="mb-6">
        <label className="block mb-2">Debate Topic:</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="e.g., Climate change, AI ethics, Space exploration"
        />
      </div>

      <div className="mb-6">
        <label className="block mb-2">Number of Turns (per agent):</label>
        <input
          type="number"
          value={turns}
          onChange={e => setTurns(parseInt(e.target.value))}
          min={1}
          max={10}
          className="w-full p-2 border rounded"
        />
      </div>

      <button
        onClick={startDebate}
        disabled={isDebating || !topic}
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        {isDebating ? 'Debate in Progress...' : 'Start Debate'}
      </button>

      <audio ref={audioRef} className="hidden" />

      {responses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Debate Transcript</h2>

          <div className="space-y-4">
            {responses.map((response, index) => (
              <div
                key={index}
                className={`p-4 rounded ${response.agent === 'Optimist' ? 'bg-blue-100' : 'bg-gray-100'}`}
              >
                <div className="flex justify-between items-center">
                  <div className="font-bold">{response.agent}:</div>
                  <button
                    onClick={() => playAudio(response.text, response.agent)}
                    disabled={isPlaying}
                    className="text-sm px-2 py-1 bg-blue-500 text-white rounded disabled:bg-gray-300"
                  >
                    {isPlaying ? 'Playing...' : 'Play'}
                  </button>
                </div>
                <p className="mt-2">{response.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const readStream = async (stream: ReadableStream): Promise<Blob> => {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new Blob(chunks, { type: 'audio/mp3' });
};
