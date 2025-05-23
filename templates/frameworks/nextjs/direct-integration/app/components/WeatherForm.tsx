'use client';

import { useState } from 'react';
import { getWeatherInfo } from '../actions';

export function WeatherForm() {
  const [location, setLocation] = useState('');
  const [weatherInfo, setWeatherInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }
    
    setLoading(true);
    setError(null);
    setWeatherInfo(null);
    
    try {
      const response = await getWeatherInfo(location);
      
      if (response.success) {
        setWeatherInfo(response.data);
      } else {
        setError(response.error || 'Failed to get weather information');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Location
          </label>
          <input
            type="text"
            id="location"
            className="weather-input"
            placeholder="Enter city or location name"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        
        <button 
          type="submit" 
          className="weather-button"
          disabled={loading}
        >
          {loading ? 'Getting weather...' : 'Get Weather'}
        </button>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
          {error}
        </div>
      )}
      
      {weatherInfo && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="font-medium text-blue-900">Weather Information</h3>
          <div className="mt-2 text-blue-800 prose">
            {weatherInfo}
          </div>
        </div>
      )}
    </div>
  );
}
