'use client';

import { useState } from 'react';

interface DirectionInputProps {
  onSubmit: (direction: string) => void;
}

export default function DirectionInput({ onSubmit }: DirectionInputProps) {
  const [direction, setDirection] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(direction);
    setDirection('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          What should happen next?
          <textarea
            value={direction}
            onChange={e => setDirection(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-2.5 bg-white dark:bg-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
            rows={3}
          />
        </label>
      </div>
      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-3 px-4 rounded-md hover:bg-blue-600 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium text-sm shadow-sm"
      >
        Continue Story
      </button>
    </form>
  );
}
