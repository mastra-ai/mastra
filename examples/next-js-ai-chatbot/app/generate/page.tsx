'use client';

import { useState } from 'react';
import { generateWeatherPlan } from './actions';

export default function GeneratePage() {
  const [city, setCity] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setResult('');

    try {
      const response = await generateWeatherPlan(city);
      setResult(response);
    } catch (error) {
      console.error('Error:', error);
      setResult('An error occurred while generating the plan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Weather agent</h1>

      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="Enter city name"
            className="flex-1 p-2 border rounded"
            required
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isLoading ? 'Generating...' : 'Enter city'}
          </button>
        </div>
      </form>

      {result && <div className="whitespace-pre-wrap font-mono p-4 rounded">{result}</div>}
    </div>
  );
}
