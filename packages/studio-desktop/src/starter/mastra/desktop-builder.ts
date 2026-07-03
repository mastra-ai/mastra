import type { AgentBuilderOptions, ProviderModelEntry } from '@mastra/core/agent-builder/ee';
import { createBuilderAgent } from '@mastra/editor/ee';
import {
  getDesktopAgentModelConfig,
  getDesktopDefaultModelEntry,
  getDesktopModelAllowlistEntries,
  getDesktopModelConfig,
} from './local-model-gateway';

const externalProviderEnv = [
  { provider: 'anthropic', envVars: ['ANTHROPIC_API_KEY'] },
  { provider: 'openai', envVars: ['OPENAI_API_KEY'] },
] as const satisfies ReadonlyArray<{ provider: ProviderModelEntry['provider']; envVars: readonly string[] }>;

function hasConfiguredEnv(envVars: readonly string[]) {
  return envVars.some(envVar => Boolean(process.env[envVar]?.trim()));
}

export function getDesktopConfiguredExternalModelAllowlistEntries(): ProviderModelEntry[] {
  return externalProviderEnv
    .filter(({ envVars }) => hasConfiguredEnv(envVars))
    .map(({ provider }) => ({ provider }));
}

export function getDesktopBuilderConfig(): AgentBuilderOptions {
  const desktopModel = getDesktopModelConfig();

  return {
    enabled: true,
    features: {
      agent: {
        browser: false,
        model: true,
      },
    },
    configuration: {
      agent: {
        models: {
          allowed: [
            ...getDesktopModelAllowlistEntries(desktopModel),
            ...getDesktopConfiguredExternalModelAllowlistEntries(),
          ],
          default: getDesktopDefaultModelEntry(desktopModel),
        },
      },
    },
  };
}

export const desktopBuilderAgent = createBuilderAgent({
  model: getDesktopAgentModelConfig(),
});
