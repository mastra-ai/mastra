import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const fetchWeatherTool = new Step({
  id: 'fetch-weather',
  description: 'Fetches weather forecast for a given city',
  inputSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
  execute: async ({ context }) => {
    const triggerData = context.machineContext?.getStepPayload<{ city: string }>('trigger');

    if (!triggerData) {
      throw new Error('Trigger data not found');
    }

    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(triggerData.city)}&count=1`;
    const geocodingResponse = await fetch(geocodingUrl);
    const geocodingData = await geocodingResponse.json();

    if (!geocodingData.results?.[0]) {
      throw new Error(`Location '${triggerData.city}' not found`);
    }

    const { latitude, longitude, name } = geocodingData.results[0];

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_mean,weathercode&timezone=auto`;
    const response = await fetch(weatherUrl);
    const data = await response.json();

    const forecast = data.daily.time.map((date: string, index: number) => ({
      date,
      maxTemp: data.daily.temperature_2m_max[index],
      minTemp: data.daily.temperature_2m_min[index],
      precipitationChance: data.daily.precipitation_probability_mean[index],
      condition: getWeatherCondition(data.daily.weathercode[index]),
      location: name,
    }));

    return forecast;
  },
});

const forecastSchema = z.array(
  z.object({
    date: z.string(),
    maxTemp: z.number(),
    minTemp: z.number(),
    precipitationChance: z.number(),
    condition: z.string(),
    location: z.string(),
  }),
);

const planActivities = new Step({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  execute: async ({ context, mastra }) => {
    const forecast = context.machineContext?.getStepPayload<z.infer<typeof forecastSchema>>('fetch-weather');

    if (!forecast) {
      throw new Error('Forecast data not found');
    }

    const prompt = `Based on the following weather forecast for ${forecast[0].location}, suggest appropriate activities:
      ${JSON.stringify(forecast, null, 2)}
      `;

    if (!mastra?.llm) {
      throw new Error('Mastra not found');
    }

    const llm = mastra.llm({
      provider: 'OPEN_AI',
      name: 'gpt-4o',
    });

    const response = await llm.stream([
      {
        role: 'system',
        content: `You are a local activities and travel expert who excels at weather-based planning. Analyze the weather data and provide practical activity recommendations.

        For each day in the forecast, structure your response exactly as follows:

        📅 [Day, Month Date, Year]
        ═══════════════════════════

        🌡️ WEATHER SUMMARY
        • Conditions: [brief description]
        • Temperature: [X°C/Y°F to A°C/B°F]
        • Precipitation: [X% chance]

        🌅 MORNING ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🌞 AFTERNOON ACTIVITIES
        Outdoor:
        • [Activity Name] - [Brief description including specific location/route]
          Best timing: [specific time range]
          Note: [relevant weather consideration]

        🏠 INDOOR ALTERNATIVES
        • [Activity Name] - [Brief description including specific venue]
          Ideal for: [weather condition that would trigger this alternative]

        ⚠️ SPECIAL CONSIDERATIONS
        • [Any relevant weather warnings, UV index, wind conditions, etc.]

        Guidelines:
        - Suggest 2-3 time-specific outdoor activities per day
        - Include 1-2 indoor backup options
        - For precipitation >50%, lead with indoor activities
        - All activities must be specific to the location
        - Include specific venues, trails, or locations
        - Consider activity intensity based on temperature
        - Keep descriptions concise but informative

        Maintain this exact formatting for consistency, using the emoji and section headers as shown.`,
      },
      {
        role: 'user',
        content: prompt,
      },
    ]);

    for await (const chunk of response.textStream) {
      process.stdout.write(chunk);
    }

    return {
      activities: response.text,
    };
  },
});

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow fall',
    73: 'Moderate snow fall',
    75: 'Heavy snow fall',
    95: 'Thunderstorm',
  };
  return conditions[code] || 'Unknown';
}

const weatherWorkflow = new Workflow({
  name: 'weather-workflow',
  triggerSchema: z.object({
    city: z.string().describe('The city to get the weather for'),
  }),
})
  .step(fetchWeatherTool)
  .then(planActivities);

weatherWorkflow.commit();

export { weatherWorkflow };