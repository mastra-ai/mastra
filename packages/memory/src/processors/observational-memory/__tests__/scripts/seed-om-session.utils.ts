import { randomUUID } from 'node:crypto';

type CacheUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens?: number;
};

function formatCacheRatio(usage: CacheUsage): string {
  if (usage.inputTokens <= 0) return '0.00%';
  const ratio = (usage.cachedInputTokens ?? 0) / usage.inputTokens;
  return `${(ratio * 100).toFixed(2)}%`;
}

export const DEFAULT_SEED_MODEL = 'cerebras/zai-glm-4.7';
export const DEFAULT_ROUNDS = 6;
export const DEFAULT_PROMPT =
  'Deep research https://mastra.ai and become an expert on it. Leave no stone unturned. Do not stop researching until you have read absolutely everything and become a Mastra master. If there is more to read or research, continue.';

export type SeedSessionCliArgs = {
  threadId: string;
  resourceId: string;
  rounds: number;
  model: string;
  prompt: string;
  stateFile?: string;
};

export function parseSeedSessionArgs(argv: string[]): SeedSessionCliArgs {
  const argMap = new Map<string, string>();

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue;
    const [key, ...valueParts] = arg.slice(2).split('=');
    if (!key) continue;
    argMap.set(key, valueParts.join('='));
  }

  const roundsRaw = argMap.get('rounds');
  const roundsParsed = roundsRaw ? Number.parseInt(roundsRaw, 10) : DEFAULT_ROUNDS;

  return {
    threadId: argMap.get('threadId') ?? `seed-thread-${randomUUID()}`,
    resourceId: argMap.get('resourceId') ?? `seed-resource-${randomUUID()}`,
    rounds: Number.isFinite(roundsParsed) && roundsParsed > 0 ? roundsParsed : DEFAULT_ROUNDS,
    model: argMap.get('model') ?? DEFAULT_SEED_MODEL,
    prompt: argMap.get('prompt') ?? DEFAULT_PROMPT,
    stateFile: argMap.get('stateFile'),
  };
}

export function formatRoundReport(round: number, usage: CacheUsage): string {
  return [
    `round=${round}`,
    `input=${usage.inputTokens}`,
    `cachedInput=${usage.cachedInputTokens ?? 0}`,
    `output=${usage.outputTokens}`,
    `total=${usage.totalTokens}`,
    `cacheRatio=${formatCacheRatio(usage)}`,
  ].join(' ');
}
