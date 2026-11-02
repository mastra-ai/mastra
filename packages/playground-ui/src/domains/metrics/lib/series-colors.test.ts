import { describe, expect, it } from 'vitest';
import { seriesColor, seriesColors, seriesLab } from './series-colors';

describe('seriesLab', () => {
  it('reads the lab from the provider, its aliases and API suffixes', () => {
    expect(seriesLab('anthropic.messages', 'claude-opus-5-5')).toBe('anthropic');
    expect(seriesLab('x-ai', 'grok-5')).toBe('xai');
    expect(seriesLab('meta-llama', 'llama-4-maverick')).toBe('meta');
  });

  it('reads routed rows from the model prefix, then the model name', () => {
    expect(seriesLab('openrouter', 'meta-llama/llama-4-scout')).toBe('meta');
    expect(seriesLab('openrouter', 'gpt-5-mini')).toBe('openai');
    expect(seriesLab(undefined, 'gemini-3.5-pro')).toBe('google');
    expect(seriesLab(undefined, 'jev-1.14.0')).toBe('typesafe');
  });

  it('keeps an unknown provider as its own lab, and has none without a provider or known model', () => {
    expect(seriesLab('cohere', 'command-a-2')).toBe('cohere');
    expect(seriesLab(undefined, 'my-model')).toBeUndefined();
  });
});

describe('seriesColors', () => {
  const ranked = (...models: string[]) => models.map(model => ({ key: model, model }));

  it("gives each lab's largest series the lab's hue, whatever its rank", () => {
    const colors = seriesColors(ranked('gpt-5-mini', 'claude-opus-5-5', 'gemini-3.5-pro', 'grok-5'));
    expect(colors.get('gpt-5-mini')).toBe('var(--chart-series-green)');
    expect(colors.get('claude-opus-5-5')).toBe('var(--chart-series-orange)');
    expect(colors.get('gemini-3.5-pro')).toBe('var(--chart-series-blue)');
    expect(colors.get('grok-5')).toBe('var(--chart-series-neutral)');
  });

  it("gives a lab's other series shifted shades of its hue, in rank order", () => {
    const colors = seriesColors(ranked('claude-opus-5-5', 'gpt-5.5', 'claude-sonnet-5-5', 'claude-haiku-5-5'));
    expect(colors.get('claude-opus-5-5')).toBe('var(--chart-series-orange)');
    expect(colors.get('claude-sonnet-5-5')).toBe(seriesColor('orange', 1));
    expect(colors.get('claude-haiku-5-5')).toBe(seriesColor('orange', 2));
  });

  it('gives series with no lab the hues no lab on the page uses', () => {
    const colors = seriesColors([
      { key: 'claude-opus-5-5', model: 'claude-opus-5-5' },
      { key: 'Production' },
      { key: 'Staging' },
    ]);
    expect(colors.get('Production')).toBe('var(--chart-series-blue)');
    // Orange is Anthropic's here, so the next key skips it.
    expect(colors.get('Staging')).toBe('var(--chart-series-green)');
  });

  it('gives a lab without a hue of its own one free hue for all its series', () => {
    const colors = seriesColors([
      { key: 'command-a-2', provider: 'cohere', model: 'command-a-2' },
      { key: 'Production' },
      { key: 'command-r', provider: 'cohere', model: 'command-r' },
    ]);
    expect(colors.get('command-a-2')).toBe('var(--chart-series-blue)');
    expect(colors.get('Production')).toBe('var(--chart-series-orange)');
    expect(colors.get('command-r')).toBe(seriesColor('blue', 1));
  });

  it("never repeats a color within a lab's first ten series", () => {
    const claudes = Array.from({ length: 10 }, (_, i) => `claude-${i}`);
    const colors = seriesColors(ranked(...claudes));
    expect(new Set(claudes.map(c => colors.get(c))).size).toBe(10);
  });

  it('hands out shades once every hue is taken', () => {
    const keys = Array.from({ length: 12 }, (_, i) => ({ key: `key-${i}` }));
    const colors = seriesColors(keys);
    expect(colors.get('key-0')).toBe('var(--chart-series-blue)');
    expect(colors.get('key-11')).toBe(seriesColor('blue', 1));
  });
});

describe('seriesColor', () => {
  it('shifts lightness, hue and chroma from the base token for later shades', () => {
    expect(seriesColor('orange')).toBe('var(--chart-series-orange)');
    expect(seriesColor('orange', 1)).toBe(
      'oklch(from var(--chart-series-orange) calc(l + 0.08) calc(c * 0.85) calc(h + 10))',
    );
  });
});
