'use client';

import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  audioData: Blob;
}

export default function AudioPlayer({ audioData }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    if (!audioRef.current || !audioData) return;

    const currentAudio = audioRef.current;
    const url = URL.createObjectURL(audioData);

    const playAudio = async () => {
      try {
        currentAudio.src = url;
        await currentAudio.load();
        await currentAudio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Auto-play failed:', error);
      }
    };

    playAudio();

    return () => {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        URL.revokeObjectURL(url);
      }
    };
  }, [audioData]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current || !isFinite(audioRef.current.duration)) return;
    const progress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(isFinite(progress) ? progress : 0);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setVolume(value);
    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      setProgress(value);
      audioRef.current.currentTime = (value / 100) * audioRef.current.duration;
    }
  };

  return (
    <div className="w-full max-w-md p-4 bg-white rounded-lg shadow-md">
      <audio ref={audioRef} onTimeUpdate={handleTimeUpdate} onEnded={handleEnded} className="hidden" />

      <div className="flex items-center justify-between mb-4">
        <button
          onClick={togglePlay}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isPlaying ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
            </svg>
          )}
        </button>

        <div className="flex-1 mx-4">
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
            onChange={handleProgressChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M12 18.75a1 1 0 100-2 1 1 0 000 2z"
            />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
