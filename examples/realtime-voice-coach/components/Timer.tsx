'use client';

import { useState, useEffect } from 'react';

interface TimerProps {
  seconds: number;
}

export function Timer({ seconds }: TimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setTimeLeft(seconds);
    setIsActive(true);
  }, [seconds]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setTimeLeft(seconds);
    setIsActive(false);
  };

  const progressPercentage = (timeLeft / seconds) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-semibold">Timer</h3>
        <span className="text-2xl font-bold">{formatTime(timeLeft)}</span>
      </div>

      <div className="w-full bg-gray-300 rounded-full h-4 mb-3">
        <div
          className="bg-blue-500 h-4 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercentage}%` }}
        ></div>
      </div>

      <div className="flex space-x-2">
        <button
          onClick={toggleTimer}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>
        <button
          onClick={resetTimer}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
