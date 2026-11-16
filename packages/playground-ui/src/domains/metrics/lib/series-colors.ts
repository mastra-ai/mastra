/**
 * Series colors for breakdowns by model, provider or any other key, from one palette of eleven hues
 * (`--chart-series-*`). Each lab reserves its hue, so a lab reads the same on every chart; its other
 * next two models take shifted shades of it, and the rest stand apart in hues of their own. Series with
 * no lab take the hues left over.
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
  google: 'indigo',
  typesafe: 'pink',
  deepseek: 'blue',
  xai: 'neutral',
  meta: 'cyan',
  mistral: 'amber',
  qwen: 'violet',
  openrouter: 'lime',
  moonshotai: 'neutral',
  minimax: 'magenta',
  zai: 'teal',
};

/** Lab hues as a map, so lookups by any string never hit `Object.prototype`. */
const LAB_HUE = new Map(Object.entries(LAB_HUES));

/** Other spellings of the labs' provider ids. */
const LAB_ALIASES = new Map([
  ['x-ai', 'xai'],
  ['z-ai', 'zai'],
  ['meta-llama', 'meta'],
  ['llama', 'meta'],
  ['mistralai', 'mistral'],
  ['gemini', 'google'],
  ['alibaba', 'qwen'],
  ['moonshot', 'moonshotai'],
  ['jev', 'typesafe'],
]);

/** Model names, for rows a host served (OpenRouter, Groq, Bedrock) or rows without a provider. */
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

/** Providers that serve other labs' models (routers, inference hosts, clouds), so the model tells the lab. */
const HOSTS = new Set([
  'openrouter',
  'codex',
  'mastra',
  'netlify',
  'vercel',
  'groq',
  'together',
  'togetherai',
  'fireworks',
  'fireworks-ai',
  'deepinfra',
  'cerebras',
  'sambanova',
  'hyperbolic',
  'novita',
  'nebius',
  'baseten',
  'azure',
  'bedrock',
  'amazon-bedrock',
  'google-vertex',
  'vertex',
]);

/** Segments of a hosted model's resource path that aren't a lab. */
const PATH_WORDS = new Set(['models', 'accounts', 'projects', 'deployments']);

/** Every lab id this file knows, with or without a hue. */
const KNOWN_LABS = new Set([...LAB_HUE.keys(), ...MODEL_LABS.map(([, lab]) => lab)]);

const cleanLab = (id: string) => {
  const [v = id] = id.toLowerCase().split('.');
  return LAB_ALIASES.get(v) ?? v;
};

const isHost = (id: string) => HOSTS.has(cleanLab(id));

/** The lab a model id names: its `lab/` prefix, a lab inside a dotted id, or its name. */
function modelLab(model: string): string | undefined {
  const parts = model.toLowerCase().split('/');
  const name = parts.pop() ?? '';
  // `lab/model`, unless the segment is a host or part of a resource path (`accounts/x/models/y`).
  const prefix = parts.pop();
  if (prefix && !isHost(prefix) && !PATH_WORDS.has(prefix)) return cleanLab(prefix);
  // Dotted ids name the lab inside (`us.anthropic.claude-…`, `meta.llama3-…` on Bedrock).
  const dotted = name
    .split('.')
    .map(cleanLab)
    .find(seg => KNOWN_LABS.has(seg));
  if (dotted) return dotted;
  return MODEL_LABS.find(([re]) => re.test(name))?.[1];
}

/**
 * The lab behind a series: its provider, or for rows a host served the lab its model names.
 *
 * @example
 * seriesLab('anthropic.messages', 'claude-opus-5-5') // 'anthropic'
 * seriesLab('openrouter', 'meta-llama/llama-4-scout') // 'meta'
 * seriesLab('groq', 'llama-4-maverick') // 'meta'
 * seriesLab(undefined, 'gpt-5-mini') // 'openai'
 */
export function seriesLab(provider?: string, model?: string): string | undefined {
  const lab = provider ? cleanLab(provider) : undefined;
  if (lab && !HOSTS.has(lab)) return lab;
  const fromModel = model ? modelLab(model) : undefined;
  return fromModel ?? lab;
}

/**
 * Shades of a hue handed out more than once: a little lighter, then darker, then further, each
 * nudged warmer or cooler. Lightness moves a share of the room left (toward white when positive,
 * toward black when negative), so a light base like xAI's white never clips. The hue nudge stays
 * under half the gap between hues, so a shade never reads as the next lab's color. Ten in all, as
 * many as a chart names; past that they repeat. `[lightness share, hue in degrees, chroma factor]`.
 */
export const SHADES: [number, number, number][] = [
  [0, 0, 1],
  [0.3, 10, 0.85],
  [-0.1, -10, 1],
  [0.55, -10, 0.75],
  [-0.2, 10, 1],
  [0.75, 0, 0.6],
  [-0.3, 0, 1],
  [0.15, -12, 0.9],
  [-0.05, 12, 1],
  [0.42, 0, 0.8],
];

/** A shade's lightness from its base's: a share of the way to white, or to black. */
export const shadeLightness = (l: number, share: number) => (share > 0 ? l + (1 - l) * share : l * (1 + share));

/** A hue's color, or its nth shade. */
export function seriesColor(hue: SeriesHue, shade = 0) {
  const base = `var(--chart-series-${hue})`;
  const [share = 0, dh = 0, c = 1] = SHADES[shade % SHADES.length] ?? [];
  if (!share && !dh) return base;
  const l = share > 0 ? `calc(l + (1 - l) * ${share})` : `calc(l * ${1 + share})`;
  return `oklch(from ${base} ${l} calc(c * ${c}) calc(h + ${dh}))`;
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
  provider?: string;
  model?: string;
};

/**
 * Colors for a page's series, keyed by `item.key`. Pass every series the page shows, ranked largest
 * first, once per page, so a model keeps its color on every chart.
 *
 * - Each lab's largest series takes the lab's hue; labs without one claim a free hue.
 * - The lab's next two series take shifted shades of it, in rank order; past those, a shared family
 *   is too hard to follow on a line chart, so the rest take hues of their own.
 * - When the page shows a single lab, a shared family tells nothing apart, so its other series all
 *   take hues of their own.
 * - Series with no lab take the hues no lab on the page uses, then shades once those run out.
 */
/** How many of a lab's series share its color family before the rest take their own hue. */
const SHARED_PER_LAB = 3;

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
    const unused = FREE_ORDER.find(h => !used.has(h));
    if (unused) return unused;
    const least = Math.min(...FREE_ORDER.map(h => used.get(h) ?? 0));
    return FREE_ORDER.find(h => used.get(h) === least) ?? 'blue';
  };

  const labs = items.map(it => seriesLab(it.provider, it.model));
  const labHue = new Map<string, SeriesHue>();
  // Series handed out per lab, so a lab's first few share its family and the rest stand apart.
  const perLab = new Map<string, number>();

  // Labs with a hue reserve it first, so a lab's largest series always gets the pure color.
  items.forEach((it, i) => {
    const lab = labs[i];
    const hue = lab ? LAB_HUE.get(lab) : undefined;
    if (lab && hue && !labHue.has(lab)) {
      labHue.set(lab, hue);
      perLab.set(lab, 1);
      take(it.key, hue);
    }
  });

  // With one lab on the page a shared family adds nothing, so its models all take their own hue.
  const singleLab = new Set(labs.filter(Boolean)).size === 1;

  items.forEach((it, i) => {
    if (colors.has(it.key)) return;
    const lab = labs[i];
    if (!lab) return take(it.key, nextFree());
    const rank = perLab.get(lab) ?? 0;
    perLab.set(lab, rank + 1);
    const hue = labHue.get(lab);
    if (!hue) {
      // A lab without a preset hue claims a free one for its family.
      const claimed = nextFree();
      labHue.set(lab, claimed);
      return take(it.key, claimed);
    }
    if (!singleLab && rank < SHARED_PER_LAB) return take(it.key, hue);
    take(it.key, nextFree());
  });
  return colors;
}
