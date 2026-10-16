import { useExecuteTool } from '@mastra/react/hooks/tools';

export interface Weather {
  city: string;
  conditions: string;
  temperatureCelsius: number;
}

/**
 * Starts from the weather the agent fetched and lets the card fetch it again.
 * Runs inside Studio, so `useExecuteTool` uses Studio's Mastra client and query cache.
 */
export function useLiveWeather(initial: Weather | undefined) {
  const { mutate, data, isPending, submittedAt } = useExecuteTool();

  return {
    weather: (data as Weather | undefined) ?? initial,
    updatedAt: data ? new Date(submittedAt) : undefined,
    isRefreshing: isPending,
    refresh: () => initial && mutate({ toolId: 'get-weather', input: { city: initial.city } }),
  };
}
