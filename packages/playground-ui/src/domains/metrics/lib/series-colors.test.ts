import { describe, expect, it } from 'vitest';
import { SHADES, seriesColor, seriesColors, seriesLab, shadeLightness } from './series-colors';

const ranked = (...models: string[]) => models.map(model => ({ key: model, model }));

describe('seriesLab', () => {
  describe('when the provider is the lab', () => {
    it('reads the lab from the provider, its aliases and API suffixes', () => {
      expect(seriesLab('anthropic.messages', 'claude-opus-5-5')).toBe('anthropic');
      expect(seriesLab('x-ai', 'grok-5')).toBe('xai');
      expect(seriesLab('meta-llama', 'llama-4-maverick')).toBe('meta');
    });

    it('keeps an unknown provider as its own lab', () => {
      expect(seriesLab('cohere', 'command-a-2')).toBe('cohere');
    });
  });

  describe('when a host served the model', () => {
    it("reads the lab from the model's prefix", () => {
      expect(seriesLab('openrouter', 'meta-llama/llama-4-scout')).toBe('meta');
    });

    it('reads the lab from the model name', () => {
      expect(seriesLab('groq', 'llama-4-maverick')).toBe('meta');
      expect(seriesLab('amazon-bedrock', 'claude-sonnet-5-5')).toBe('anthropic');
      expect(seriesLab('google-vertex', 'gemini-3.5-pro')).toBe('google');
      expect(seriesLab('openrouter', 'gpt-5-mini')).toBe('openai');
    });

    it('reads the lab inside a dotted Bedrock id', () => {
      expect(seriesLab('amazon-bedrock', 'us.anthropic.claude-opus-4-6-v1')).toBe('anthropic');
      expect(seriesLab('amazon-bedrock', 'meta.llama3-70b-instruct-v1:0')).toBe('meta');
    });

    it('skips the segments of a resource path', () => {
      expect(seriesLab('fireworks', 'accounts/fireworks/models/llama-v3p3-70b-instruct')).toBe('meta');
    });
  });

  describe('when there is no provider', () => {
    it('reads the lab from the model name', () => {
      expect(seriesLab(undefined, 'gpt-5.5')).toBe('openai');
      expect(seriesLab(undefined, 'gemini-3.5-pro')).toBe('google');
      expect(seriesLab(undefined, 'jev-1.14.0')).toBe('typesafe');
    });

    it('has no lab for a model it does not know', () => {
      expect(seriesLab(undefined, 'my-model')).toBeUndefined();
      expect(seriesLab(undefined, 'constructor')).toBeUndefined();
    });
  });
});

describe('seriesColors', () => {
  describe('when labs are on the page', () => {
    it("gives each lab's largest series the lab's hue, whatever its rank", () => {
      const colors = seriesColors(ranked('gpt-5-mini', 'claude-opus-5-5', 'gemini-3.5-pro', 'deepseek-v4', 'grok-5'));
      expect(colors.get('gpt-5-mini')).toBe('var(--chart-series-green)');
      expect(colors.get('claude-opus-5-5')).toBe('var(--chart-series-orange)');
      expect(colors.get('gemini-3.5-pro')).toBe('var(--chart-series-indigo)');
      expect(colors.get('deepseek-v4')).toBe('var(--chart-series-blue)');
      expect(colors.get('grok-5')).toBe('var(--chart-series-neutral)');
    });

    it('gives OpenRouter lime and Moonshot neutral', () => {
      const colors = seriesColors([
        { key: 'openrouter', provider: 'openrouter' },
        { key: 'kimi-k2.5', model: 'kimi-k2.5' },
      ]);
      expect(colors.get('openrouter')).toBe('var(--chart-series-lime)');
      expect(colors.get('kimi-k2.5')).toBe('var(--chart-series-neutral)');
    });

    it("gives a lab's other series shifted shades of its hue, in rank order", () => {
      const colors = seriesColors(ranked('claude-opus-5-5', 'gpt-5.5', 'claude-sonnet-5-5', 'claude-haiku-5-5'));
      expect(colors.get('claude-sonnet-5-5')).toBe(seriesColor('orange', 1));
      expect(colors.get('claude-haiku-5-5')).toBe(seriesColor('orange', 2));
    });

    it("gives a lab's fourth series on a hue of its own", () => {
      const colors = seriesColors(ranked('gpt-5.5', 'claude-opus-5-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1'));
      expect(colors.get('gpt-5-nano')).toBe(seriesColor('green', 2));
      expect(colors.get('gpt-4.1')).toBe('var(--chart-series-blue)');
    });

    it("never repeats a color within a lab's first ten series", () => {
      const claudes = Array.from({ length: 10 }, (_, i) => `claude-${i}`);
      const colors = seriesColors(ranked(...claudes));
      expect(new Set(claudes.map(c => colors.get(c))).size).toBe(10);
    });
  });

  describe('when the page shows a single lab', () => {
    it("keeps the lab's hue on its largest series and gives the rest hues of their own", () => {
      const colors = seriesColors(ranked('o5', 'gpt-5.5', 'gpt-5-mini'));
      expect(colors.get('o5')).toBe('var(--chart-series-green)');
      expect(colors.get('gpt-5.5')).toBe('var(--chart-series-blue)');
      expect(colors.get('gpt-5-mini')).toBe('var(--chart-series-orange)');
    });
  });

  describe('when a lab has no hue of its own', () => {
    it('gives all its series one free hue', () => {
      const colors = seriesColors([
        { key: 'claude-opus-5-5', model: 'claude-opus-5-5' },
        { key: 'command-a-2', provider: 'cohere', model: 'command-a-2' },
        { key: 'command-r', provider: 'cohere', model: 'command-r' },
      ]);
      expect(colors.get('command-a-2')).toBe('var(--chart-series-blue)');
      expect(colors.get('command-r')).toBe(seriesColor('blue', 1));
    });
  });

  describe('when series have no lab', () => {
    it('gives them the hues no lab on the page uses', () => {
      const colors = seriesColors([
        { key: 'claude-opus-5-5', model: 'claude-opus-5-5' },
        { key: 'Production' },
        { key: 'Staging' },
      ]);
      expect(colors.get('Production')).toBe('var(--chart-series-blue)');
      // Orange is Anthropic's here, so the next key skips it.
      expect(colors.get('Staging')).toBe('var(--chart-series-green)');
    });

    it('hands out shades once every hue is taken', () => {
      const colors = seriesColors(Array.from({ length: 12 }, (_, i) => ({ key: `key-${i}` })));
      expect(colors.get('key-11')).toBe(seriesColor('blue', 1));
    });
  });
});

describe('seriesColor', () => {
  describe('when asked for the base', () => {
    it('returns the token', () => {
      expect(seriesColor('orange')).toBe('var(--chart-series-orange)');
    });
  });

  describe('when asked for a shade', () => {
    it('moves lightness a share of the way to white or black, with a hue nudge and less chroma', () => {
      expect(seriesColor('orange', 1)).toBe(
        'oklch(from var(--chart-series-orange) calc(l + (1 - l) * 0.3) calc(c * 0.85) calc(h + 10))',
      );
      expect(seriesColor('orange', 2)).toBe(
        'oklch(from var(--chart-series-orange) calc(l * 0.9) calc(c * 1) calc(h + -10))',
      );
    });

    // Base lightness of the series tokens: light-mode neutral, light mode, dark mode, dark amber, dark neutral.
    it.each([0.32, 0.62, 0.76, 0.82, 0.9])('keeps ten distinct shades inside the gamut from lightness %s', l => {
      const shades = SHADES.map(([share]) => shadeLightness(l, share)).toSorted((a, b) => a - b);
      for (const v of shades) {
        expect(v).toBeGreaterThan(0.05);
        expect(v).toBeLessThan(0.99);
      }
      const gaps = shades.slice(1).map((v, i) => v - (shades[i] ?? 0));
      expect(Math.min(...gaps)).toBeGreaterThan(0.004);
    });
  });
});
