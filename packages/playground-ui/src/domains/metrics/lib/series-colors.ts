/**
 * Series colors for breakdowns by model, provider or any other key, from one palette of eleven hues
 * (`--chart-series-*`). Each lab reserves its hue, so a lab reads the same on every chart; its other
 * models take shifted shades of it. Series with no lab take the hues left over.
 */

export const SERIES_HUES = [
  'pink',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'magenta',
] as const;

export type SeriesHue = (typeof SERIES_HUES)[number] | 'neutral';

/** Each lab's hue, by the provider ids `ProviderLogo` knows. Labs not listed take a free hue. */
export const LAB_HUES: Record<string, SeriesHue> = {
  anthropic: 'orange',
  openai: 'green',
  google: 'blue',
  typesafe: 'pink',
  deepseek: 'indigo',
  xai: 'neutral',
  meta: 'cyan',
  mistral: 'amber',
  qwen: 'violet',
  nvidia: 'lime',
  minimax: 'magenta',
  zai: 'teal',
};

/** Other spellings of the labs' provider ids. */
const LAB_ALIASES: Record<string, string> = {
  'x-ai': 'xai',
  'z-ai': 'zai',
  'meta-llama': 'meta',
  llama: 'meta',
  mistralai: 'mistral',
  gemini: 'google',
  'google-vertex': 'google',
  alibaba: 'qwen',
  moonshot: 'moonshotai',
  jev: 'typesafe',
};

/** Model names, for rows a router served (OpenRouter, Codex) or rows without a provider. */
const MODEL_LABS: [RegExp, string][] = [
  [/^claude/, 'anthropic'],
  [/^(gpt|o[1345](-|$)|chatgpt|codex)/, 'openai'],
  [/^(gemini|gemma)/, 'google'],
  [/^jev/, 'typesafe'],
  [/^deepseek/, 'deepseek'],
  [/^grok/, 'xai'],
  [/^llama/, 'meta'],
  [/^(mistral|mixtral|codestral|magistral|devstral|ministral)/, 'mistral'],
  [/^(qwen|qwq)/, 'qwen'],
  [/^(nemotron|nvidia)/, 'nvidia'],
  [/^minimax/, 'minimax'],
  [/^glm/, 'zai'],
  [/^kimi/, 'moonshotai'],
];

/** Providers that route to other labs' models, so the model tells the lab. */
const ROUTERS = new Set(['openrouter', 'codex', 'mastra', 'netlify']);

const cleanLab = (id: string) => {
  const [v = id] = id.toLowerCase().split('.');
  return LAB_ALIASES[v] ?? v;
};

/**
 * The lab behind a series: its provider, or for routed rows the model's `lab/` prefix or name.
 *
 * @example
 * seriesLab('anthropic.messages', 'claude-opus-5-5') // 'anthropic'
 * seriesLab('openrouter', 'meta-llama/llama-4-scout') // 'meta'
 * seriesLab(undefined, 'gpt-5-mini') // 'openai'
 */
export function seriesLab(provider?: string | null, model?: string | null): string | undefined {
  const lab = provider ? cleanLab(provider) : undefined;
  if (lab && !ROUTERS.has(lab)) return lab;
  if (!model) return lab;
  const parts = model.toLowerCase().split('/');
  const name = parts.pop() ?? '';
  const prefix = parts.pop();
  if (prefix && !ROUTERS.has(cleanLab(prefix))) return cleanLab(prefix);
  return MODEL_LABS.find(([re]) => re.test(name))?.[1] ?? lab;
}

/**
 * Shades of a hue handed out more than once: a little lighter, then darker, then further, each
 * nudged warmer or cooler. The nudge stays under half the gap between hues, so a shade never reads
 * as the next lab's color. Ten in all, as many as a chart names; past that they repeat.
 * `[lightness, hue in degrees, chroma factor]`.
 */
const SHADES: [number, number, number][] = [
  [0, 0, 1],
  [0.08, 10, 0.85],
  [-0.08, -10, 1],
  [0.15, -10, 0.75],
  [-0.15, 10, 1],
  [0.22, 0, 0.65],
  [-0.22, 0, 1],
  [0.04, -12, 0.9],
  [-0.04, 12, 1],
  [0.11, 0, 0.8],
];

/** A hue's color, or its nth shade. */
export function seriesColor(hue: SeriesHue, shade = 0) {
  const base = `var(--chart-series-${hue})`;
  const [dl = 0, dh = 0, c = 1] = SHADES[shade % SHADES.length] ?? [];
  if (!dl && !dh) return base;
  return `oklch(from ${base} calc(l + ${dl}) calc(c * ${c}) calc(h + ${dh}))`;
}

/** The order hues go to series with no lab, each far from the one before. */
const FREE_ORDER: SeriesHue[] = [
  'blue',
  'orange',
  'green',
  'violet',
  'amber',
  'cyan',
  'pink',
  'lime',
  'indigo',
  'teal',
  'magenta',
];

export type SeriesColorItem = {
  /** What the lookup is keyed by: a model name, a provider id, an API key id. */
  key: string;
  provider?: string | null;
  model?: string | null;
};

/**
 * Colors for a page's series, keyed by `item.key`. Pass every series the page shows, ranked largest
 * first, once per page, so a model keeps its color on every chart.
 *
 * - Each lab's largest series takes the lab's hue; labs without one claim a free hue.
 * - The lab's other series take shifted shades of it, in rank order.
 * - Series with no lab take the hues no lab on the page uses, then shades once those run out.
 */
export function seriesColors(items: SeriesColorItem[]) {
  const colors = new Map<string, string>();
  // Shades handed out per hue.
  const used = new Map<SeriesHue, number>();
  const take = (key: string, hue: SeriesHue) => {
    const shade = used.get(hue) ?? 0;
    used.set(hue, shade + 1);
    colors.set(key, seriesColor(hue, shade));
  };
  /** The next hue for a series or lab with none: unused first, then the least used. */
  const nextFree = () => {
    const unused = FREE_ORDER.filter(h => !used.has(h));
    if (unused.length) return unused[0] ?? 'blue';
    const least = Math.min(...FREE_ORDER.map(h => used.get(h) ?? 0));
    return FREE_ORDER.find(h => (used.get(h) ?? 0) === least) ?? 'blue';
  };

  const labs = items.map(it => seriesLab(it.provider, it.model));
  const labHue = new Map<string, SeriesHue>();

  // Labs with a hue reserve it first, so a lab's largest series always gets the pure color.
  items.forEach((it, i) => {
    const lab = labs[i];
    const hue = lab ? LAB_HUES[lab] : undefined;
    if (lab && hue && !labHue.has(lab)) {
      labHue.set(lab, hue);
      take(it.key, hue);
    }
  });

  items.forEach((it, i) => {
    if (colors.has(it.key)) return;
    const lab = labs[i];
    if (!lab) return take(it.key, nextFree());
    const hue = labHue.get(lab) ?? nextFree();
    labHue.set(lab, hue);
    take(it.key, hue);
  });
  return colors;
}
