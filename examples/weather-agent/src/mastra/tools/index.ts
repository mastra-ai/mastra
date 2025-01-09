import { createTool } from '@mastra/core';
import { z } from 'zod';

interface WeatherResponse {
  data: {
    time: string;
    values: {
      temperature: number;
      temperatureApparent: number;
      humidity: number;
      windSpeed: number;
      windDirection: number;
      windGust: number;
      pressureSurfaceLevel: number;
      precipitationProbability: number;
      cloudCover: number;
      visibility: number;
      uvIndex: number;
      weatherCode: number;
    };
  };
  location: {
    name: string;
    lat: number;
    lon: number;
  };
}

export const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string().describe('City name'),
  }),
  outputSchema: z.object({
    temperature: z.number(),
    feelsLike: z.number(),
    humidity: z.number(),
    windSpeed: z.number(),
    windGust: z.number(),
    conditions: z.string(),
    location: z.string(),
  }),
  execute: async ({ context }) => {
    return await getWeather(context.location);
  },
});

const getWeather = async (location: string) => {
  const apiKey = process.env.TOMORROW_API_KEY;
  const url = `https://api.tomorrow.io/v4/weather/realtime?location=${encodeURIComponent(location)}&apikey=${apiKey}`;

  const response = await fetch(url);
  const {
    data,
    location: { name },
  }: WeatherResponse = await response.json();
  return {
    temperature: data.values.temperature,
    feelsLike: data.values.temperatureApparent,
    humidity: data.values.humidity,
    windSpeed: data.values.windSpeed,
    windGust: data.values.windGust,
    conditions: getWeatherCondition(data.values.weatherCode),
    location: name,
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    1000: 'Clear',
    1100: 'Mostly Clear',
    1101: 'Partly Cloudy',
    1102: 'Mostly Cloudy',
    2000: 'Fog',
    4000: 'Drizzle',
    4001: 'Rain',
    4200: 'Light Rain',
    4201: 'Heavy Rain',
    5000: 'Snow',
    5001: 'Flurries',
    5100: 'Light Snow',
    5101: 'Heavy Snow',
    6000: 'Freezing Drizzle',
    6001: 'Freezing Rain',
    6200: 'Light Freezing Rain',
    6201: 'Heavy Freezing Rain',
    7000: 'Ice Pellets',
    7101: 'Heavy Ice Pellets',
    7102: 'Light Ice Pellets',
    8000: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}
