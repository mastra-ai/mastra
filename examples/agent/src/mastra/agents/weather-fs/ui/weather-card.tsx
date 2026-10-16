import type { ToolStudioComponentProps } from '@mastra/core/tools';
import { AvailableAgents } from './available-agents';
import { useLiveWeather } from './use-live-weather';
import type { Weather } from './use-live-weather';

type WeatherCardProps = ToolStudioComponentProps<{ city: string }, Weather>;

/**
 * Rendered by Studio for each `get_weather` call, in place of the default tool card.
 */
export function WeatherCard({ input, output }: WeatherCardProps) {
  const { weather, updatedAt, isRefreshing, refresh } = useLiveWeather(output);

  if (!weather) return <p>Checking the weather in {input?.city ?? '…'}</p>;

  return (
    <section
      aria-label="Weather card"
      style={{
        maxWidth: 320,
        padding: 16,
        borderRadius: 12,
        color: 'white',
        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
      }}
    >
      <strong>{weather.city}</strong>
      <div style={{ fontSize: 36, fontWeight: 600 }}>{weather.temperatureCelsius}°C</div>
      <div style={{ textTransform: 'capitalize' }}>{weather.conditions}</div>
      <button type="button" onClick={refresh} disabled={isRefreshing} style={{ marginTop: 12 }}>
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </button>
      {updatedAt && <small style={{ marginLeft: 8 }}>Updated {updatedAt.toLocaleTimeString()}</small>}
      <AvailableAgents />
    </section>
  );
}
