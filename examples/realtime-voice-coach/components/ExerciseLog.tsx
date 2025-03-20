'use client';

import { ExerciseLogInput } from '../tools';

interface ExerciseLogProps {
  logs: ExerciseLogInput[];
}

export function ExerciseLog({ logs }: ExerciseLogProps) {
  if (logs.length === 0) {
    return null;
  }

  const getSentimentColor = (sentiment: string) => {
    const lowerSentiment = sentiment.toLowerCase();
    if (lowerSentiment.includes('good') || lowerSentiment.includes('great') || lowerSentiment.includes('excellent')) {
      return 'bg-green-100 text-green-800';
    } else if (
      lowerSentiment.includes('bad') ||
      lowerSentiment.includes('poor') ||
      lowerSentiment.includes('terrible')
    ) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-yellow-100 text-yellow-800';
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-2">Exercise Log</h3>
      <div className="space-y-3">
        {logs.map((log, index) => (
          <div key={index} className="bg-white p-4 rounded-md shadow-sm">
            <div className="flex justify-between items-start">
              <h4 className="text-lg font-medium">{log.exercise}</h4>
              <span className={`px-2 py-1 rounded-full text-sm ${getSentimentColor(log.sentiment)}`}>
                {log.sentiment}
              </span>
            </div>
            <p className="text-gray-600 mt-1">
              {log.sets} sets × {log.reps} reps
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
