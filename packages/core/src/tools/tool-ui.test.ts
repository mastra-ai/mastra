import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool, Tool } from './tool';

describe('tool ui config', () => {
  const WeatherCard = () => null;

  it('keeps the studio component passed to createTool', () => {
    const tool = createTool({
      id: 'weather',
      description: 'Get the weather',
      inputSchema: z.object({ city: z.string() }),
      ui: { studioComponent: WeatherCard },
    });

    expect(tool.ui?.studioComponent).toBe(WeatherCard);
  });

  it('keeps the studio component passed to new Tool', () => {
    const tool = new Tool({ id: 'weather', description: 'Get the weather', ui: { studioComponent: WeatherCard } });

    expect(tool.ui?.studioComponent).toBe(WeatherCard);
  });

  it('leaves ui undefined when not provided', () => {
    const tool = createTool({ id: 'weather', description: 'Get the weather' });

    expect(tool.ui).toBeUndefined();
  });
});
