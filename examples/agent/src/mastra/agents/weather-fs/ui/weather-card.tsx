import type { ToolStudioComponentProps } from '@mastra/core/tools';
import { useState } from 'react';
import { AvailableAgents } from './available-agents';
import { useCountUp } from './use-count-up';
import { useLiveWeather } from './use-live-weather';
import type { Weather } from './use-live-weather';
import { useTilt } from './use-tilt';
import { WEATHER_CARD_CSS } from './weather-card-styles';
import { PinIcon, RefreshIcon, SceneIcon } from './weather-icons';
import { WeatherScene } from './weather-scene';
import { SCENES, THEMES, sceneFor } from './weather-theme';
import type { Scene } from './weather-theme';

type WeatherCardProps = ToolStudioComponentProps<{ city: string }, Weather>;

/**
 * Rendered by Studio for each `get_weather` call, in place of the default tool card.
 */
export function WeatherCard({ input, output, state, errorText }: WeatherCardProps) {
  const { weather, updatedAt, isRefreshing, refresh } = useLiveWeather(output);
  const [preview, setPreview] = useState<Scene>();
  const tilt = useTilt<HTMLElement>();

  const reportedScene = weather ? sceneFor(weather.conditions) : 'cloudy';
  const scene = preview ?? reportedScene;
  const theme = THEMES[scene];
  const celsius = preview ? theme.sampleCelsius : (weather?.temperatureCelsius ?? 0);
  const shownCelsius = useCountUp(celsius);

  const city = weather?.city ?? input?.city ?? '…';

  return (
    <section
      aria-label={`Weather in ${city}`}
      className={isRefreshing ? 'wx-card wx-busy' : 'wx-card'}
      style={{ '--wx-shadow': theme.shadow }}
      {...tilt}
    >
      <style href="mastra-weather-card" precedence="default">
        {WEATHER_CARD_CSS}
      </style>

      <WeatherScene key={scene} scene={scene} theme={theme} />
      {isRefreshing && <div className="wx-sweep" />}
      <div className="wx-glare" />
      <div className="wx-rim" />

      <div className="wx-content">
        {state === 'output-error' ? (
          <div className="wx-status">
            <strong>Weather unavailable</strong>
            {errorText && <span className="wx-meta">{errorText}</span>}
          </div>
        ) : !weather ? (
          <div className="wx-status" role="status">
            <span className="wx-radar" />
            <span>Checking the weather in {city}</span>
          </div>
        ) : (
          <>
            <div className="wx-city wx-rise" style={{ '--i': 0 }}>
              <PinIcon />
              <span>{city}</span>
            </div>
            <div className="wx-sub wx-rise" style={{ '--i': 1 }}>
              {updatedAt ? `Updated ${updatedAt.toLocaleTimeString()}` : 'Live from get_weather'}
            </div>

            <div className="wx-temp" aria-label={`${celsius} degrees Celsius`}>
              {shownCelsius}
              <span className="wx-deg">°C</span>
            </div>

            <div className="wx-cond wx-rise" style={{ '--i': 2 }}>
              <span className="wx-dot" />
              {preview ? theme.label : weather.conditions}
              {preview && <span className="wx-tag">Preview</span>}
            </div>

            <div className="wx-chips wx-rise" role="group" aria-label="Preview a weather scene" style={{ '--i': 3 }}>
              {SCENES.map(option => (
                <button
                  key={option}
                  type="button"
                  className="wx-chip"
                  aria-label={`Preview ${THEMES[option].label}`}
                  aria-pressed={scene === option}
                  title={THEMES[option].label}
                  onClick={() => setPreview(option === reportedScene ? undefined : option)}
                >
                  <SceneIcon scene={option} />
                </button>
              ))}
            </div>

            <div className="wx-panel wx-rise" style={{ '--i': 4 }}>
              <div className="wx-row">
                <button
                  type="button"
                  className="wx-btn"
                  onClick={() => {
                    setPreview(undefined);
                    refresh();
                  }}
                  disabled={isRefreshing}
                >
                  <RefreshIcon />
                  {isRefreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <span className="wx-meta">via @mastra/react</span>
              </div>
              <AvailableAgents />
            </div>
          </>
        )}
      </div>
    </section>
  );
}
