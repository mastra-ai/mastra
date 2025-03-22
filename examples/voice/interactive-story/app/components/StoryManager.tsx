'use client';

import { useState } from 'react';
import StoryForm from './StoryForm';
import AudioPlayer from './AudioPlayer';
import DirectionInput from './DirectionInput';
import { mastraClient } from '@/lib/mastra-client';

type StoryPhase = 'input' | 'beginning' | 'middle' | 'end';
interface FormattedContent {
  story: string;
  choices?: string[];
}

interface StoryState {
  phase: StoryPhase;
  threadId: string;
  resourceId: string;
  content: {
    beginning?: string;
    middle?: string;
    end?: string;
  };
}

// Define the interface for formData
interface FormData {
  genre: string;
  protagonistDetails: {
    name: string;
    age: number;
    gender: string;
    occupation: string;
  };
  setting: string;
}

const formatContent = (content: string): FormattedContent => {
  const parts = content.split(/(?=\d\.\s)/);
  if (parts.length === 1) {
    return { story: content.trim() };
  }

  const story = parts[0].trim();
  const choices = parts.slice(1).map(choice => choice.trim().replace(/^\d+\.\s*/, ''));

  return { story, choices };
};

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

export default function StoryManager() {
  const [isLoading, setIsLoading] = useState(false);
  const [storyState, setStoryState] = useState<StoryState>({
    phase: 'input',
    threadId: crypto.randomUUID(),
    resourceId: 'story-user', // Fixed resourceId for the user
    content: {
      beginning: undefined,
      middle: undefined,
      end: undefined,
    },
  });
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const handleInitialSubmit = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const agent = mastraClient.getAgent('storyTellerAgent');
      const message = `Current phase: BEGINNING. Story genre: ${formData.genre}, Protagonist name: ${formData.protagonistDetails.name}, Protagonist age: ${formData.protagonistDetails.age}, Protagonist gender: ${formData.protagonistDetails.gender}, Protagonist occupation: ${formData.protagonistDetails.occupation}, Story Setting: ${formData.setting}`;
      const storyResponse = await agent.generate({
        messages: [{ role: 'user', content: message }],
        threadId: storyState.threadId,
        resourceId: storyState.resourceId,
      });

      const storyText = storyResponse.text;

      const audioResponse = await agent.voice.speak(storyText);

      if (!audioResponse.body) {
        throw new Error('No audio stream received');
      }

      const audio = await readStream(audioResponse.body);

      setStoryState(prev => ({
        phase: 'beginning',
        threadId: prev.threadId,
        resourceId: prev.resourceId,
        content: {
          ...prev.content,
          beginning: storyText,
        },
      }));

      setAudioBlob(audio);
      return audio;
    } catch (error) {
      console.error('Error generating story beginning:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectionSubmit = async (direction: string) => {
    setIsLoading(true);
    try {
      const agent = mastraClient.getAgent('storyTellerAgent');
      const nextPhase = storyState.phase === 'beginning' ? 'middle' : 'end';
      const storyResponse = await agent.generate({
        messages: [
          {
            role: 'user',
            content: `Current phase: ${storyState.phase}. Continue the story for next phase ${nextPhase}: ${direction}`,
          },
        ],
        threadId: storyState.threadId,
        resourceId: storyState.resourceId,
      });

      const storyText = storyResponse.text;
      const audioResponse = await agent.voice.speak(storyText);

      if (!audioResponse.body) {
        throw new Error('No audio stream received');
      }

      const audio = await readStream(audioResponse.body);

      setStoryState(prev => ({
        phase: nextPhase,
        threadId: prev.threadId,
        resourceId: prev.resourceId,
        content: {
          ...prev.content,
          [nextPhase]: storyText,
        },
      }));

      setAudioBlob(audio);
      return audio;
    } catch (error) {
      console.error(`Error generating story ${storyState.phase}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      <span className="ml-3 text-lg text-gray-600 dark:text-gray-300">Generating story...</span>
    </div>
  );

  const renderCurrentPhase = () => {
    if (isLoading) {
      return <LoadingSpinner />;
    }

    switch (storyState.phase) {
      case 'input':
        return <StoryForm onSubmit={handleInitialSubmit} />;

      case 'beginning':
      case 'middle':
        return (
          <div className="space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              <div className="space-y-4">
                {(storyState.phase === 'beginning' || storyState.phase === 'middle' || storyState.phase === 'end') && (
                  <div className="space-y-4">
                    <p className="text-lg">{formatContent(storyState.content[storyState.phase] || '').story}</p>
                    {formatContent(storyState.content[storyState.phase] || '').choices && (
                      <div className="space-y-2">
                        <p className="font-semibold">What happens next?</p>
                        <ul className="list-decimal list-inside space-y-2 max-w-xl">
                          {formatContent(storyState.content[storyState.phase] || '').choices?.map((choice, index) => (
                            <li key={index} className="text-lg">
                              {choice}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-center">
              <DirectionInput onSubmit={handleDirectionSubmit} />
            </div>
          </div>
        );

      case 'end':
        return (
          <div className="space-y-6">
            <div className="prose dark:prose-invert max-w-none">
              <div className="space-y-4">
                <div className="space-y-4">
                  <p className="text-lg">{formatContent(storyState.content.end || '').story}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setStoryState({
                    phase: 'input',
                    threadId: crypto.randomUUID(),
                    resourceId: 'story-user',
                    content: {
                      beginning: undefined,
                      middle: undefined,
                      end: undefined,
                    },
                  });
                  setAudioBlob(null);
                }}
                className="px-4 py-2 bg-blue-500 text-white rounded-md"
              >
                Start New Story
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 px-4">
      <h1 className="text-3xl font-bold text-center">Interactive Story Generator</h1>
      <div className="flex flex-col items-center space-y-8">
        <div className="w-full max-w-md">{renderCurrentPhase()}</div>
        {audioBlob && (
          <div className="w-full max-w-md mt-8">
            <AudioPlayer audioData={audioBlob} />
          </div>
        )}
      </div>
    </div>
  );
}
