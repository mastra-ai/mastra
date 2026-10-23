export type ResolvedModel = {
  provider?: string;
  providerName?: string;
  model: string;
  modelName: string;
};

const PROVIDER_NAMES = new Map([
  ['anthropic', 'Anthropic'],
  ['openai', 'OpenAI'],
  ['google', 'Google'],
  ['xai', 'xAI'],
  ['mistral', 'Mistral'],
  ['groq', 'Groq'],
  ['deepseek', 'DeepSeek'],
  ['openrouter', 'OpenRouter'],
  ['meta', 'Meta'],
  ['perplexity', 'Perplexity'],
  ['togetherai', 'Together AI'],
  ['fireworks-ai', 'Fireworks AI'],
  ['cerebras', 'Cerebras'],
  ['vercel', 'Vercel AI Gateway'],
  ['netlify', 'Netlify'],
  ['deepinfra', 'Deep Infra'],
  ['moonshotai', 'Moonshot AI'],
  ['alibaba', 'Alibaba'],
  ['zai', 'Z.AI'],
  ['huggingface', 'Hugging Face'],
  ['nvidia', 'Nvidia'],
  ['lmstudio', 'LMStudio'],
]);

const WORD_NAMES = new Map([
  ['gpt', 'GPT'],
  ['oss', 'OSS'],
  ['deepseek', 'DeepSeek'],
  ['glm', 'GLM'],
  ['qwq', 'QwQ'],
]);

const DATE_SUFFIX = /(-\d{8}|-\d{4}-\d{2}-\d{2}|-\d{2}-\d{4}|-\d{4})$/;
const BEDROCK_VENDOR_PREFIXES = /^(?:[a-z]+\.)+/i;
const BEDROCK_API_VERSION = /-v\d+:0$/;
const WORD_WITH_MAJOR_VERSION = /^([a-z]{2,})(\d+)$/;

const titleCase = (word: string) => WORD_NAMES.get(word) ?? word.charAt(0).toUpperCase() + word.slice(1);

function formatWord(word: string) {
  if (/^o\d/.test(word)) return word;
  if (/^\d+(\.\d+)?[bkm]$/.test(word)) return word.toUpperCase();
  return titleCase(word);
}

export function formatModelName(model: string): string {
  const base = (model.split('/').pop() || model).replace(BEDROCK_VENDOR_PREFIXES, '').replace(BEDROCK_API_VERSION, '');
  const tokens = base
    .toLowerCase()
    .replace(DATE_SUFFIX, '')
    .split(/[-_\s]+/)
    .filter(Boolean);

  const words: string[] = [];
  for (const token of tokens) {
    const previous = words[words.length - 1];
    const wordWithMajor = previous?.match(WORD_WITH_MAJOR_VERSION);
    if (previous && /^\d+$/.test(previous) && /^\d$/.test(token)) {
      words[words.length - 1] = `${previous}.${token}`;
    } else if (wordWithMajor?.[1] && wordWithMajor[2] && /^\d$/.test(token)) {
      words.splice(-1, 1, wordWithMajor[1], `${wordWithMajor[2]}.${token}`);
    } else {
      words.push(token);
    }
  }

  return words
    .map(formatWord)
    .join(' ')
    .replace(/^GPT (\S)/, 'GPT-$1');
}

export function formatProviderName(provider: string): string {
  return PROVIDER_NAMES.get(provider) ?? provider.split(/[-_]/).filter(Boolean).map(titleCase).join(' ');
}

export function resolveModel(value: string): ResolvedModel {
  const trimmed = value.trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0 || slash === trimmed.length - 1) return { model: trimmed, modelName: formatModelName(trimmed) };
  const provider = (trimmed.slice(0, slash).split('.')[0] ?? '').toLowerCase();
  const model = trimmed.slice(slash + 1);
  return { provider, providerName: formatProviderName(provider), model, modelName: formatModelName(model) };
}
