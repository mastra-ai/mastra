import * as p from '@clack/prompts';
import color from 'picocolors';

import type { CreateContext } from '../context.js';

const PROVIDERS = {
  anthropic: { label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
  openai: { label: 'OpenAI', envVar: 'OPENAI_API_KEY' },
} as const;

export type LlmProvider = keyof typeof PROVIDERS;

export function isLlmProvider(value: string): value is LlmProvider {
  return Object.hasOwn(PROVIDERS, value);
}

/**
 * Model provider step: pick Anthropic/OpenAI and provide an API key. Both the
 * selection and the key are skippable — keys can be added later in the web
 * UI (Settings › Models) or in `.env`.
 */
export async function modelStep(
  ctx: CreateContext,
  preset: { provider?: LlmProvider; apiKey?: string; nonInteractive?: boolean },
): Promise<void> {
  let provider = preset.provider;

  if (!provider && preset.nonInteractive) {
    ctx.followUps.push('Add a model provider API key in the web UI (Settings › Models) or .env');
    return;
  }

  if (!provider) {
    const selection = await p.select({
      message: 'Which model provider do you want to use?',
      options: [
        { value: 'anthropic', label: 'Anthropic', hint: 'Claude models' },
        { value: 'openai', label: 'OpenAI', hint: 'GPT / Codex models' },
        { value: 'skip', label: 'Skip for now', hint: 'add a key later in Settings › Models' },
      ],
      initialValue: 'anthropic',
    });
    if (p.isCancel(selection) || selection === 'skip') {
      ctx.followUps.push('Add a model provider API key in the web UI (Settings › Models) or .env');
      ctx.analytics.trackEvent('sf_model_provider_selected', { provider: 'skipped' });
      return;
    }
    provider = selection as LlmProvider;
  }

  const { label, envVar } = PROVIDERS[provider];
  let apiKey = preset.apiKey;

  if (!apiKey && preset.nonInteractive) {
    ctx.followUps.push(`Set ${envVar} in .env (or add the key in Settings › Models)`);
    ctx.analytics.trackEvent('sf_model_provider_selected', { provider });
    return;
  }

  if (!apiKey) {
    const entered = await p.password({
      message: `${label} API key ${color.dim('(leave empty to add later)')}`,
      validate: () => undefined,
    });
    if (p.isCancel(entered)) {
      ctx.followUps.push(`Set ${envVar} in .env (or add the key in Settings › Models)`);
      return;
    }
    apiKey = (entered ?? '').trim();
  }

  ctx.analytics.trackEvent('sf_model_provider_selected', { provider });

  if (apiKey) {
    ctx.env.set(envVar, apiKey);
    p.log.success(`${label} configured (${envVar})`);
  } else {
    ctx.followUps.push(`Set ${envVar} in .env (or add the key in Settings › Models)`);
    p.log.info(`Skipping the ${label} key — the app boots without it, agents need it to run.`);
  }
}
