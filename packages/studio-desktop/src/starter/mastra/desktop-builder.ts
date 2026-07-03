import type { AgentBuilderOptions } from '@mastra/core/agent-builder/ee';
import { createBuilderAgent } from '@mastra/editor/ee';
import {
  getDesktopAgentModelConfig,
  getDesktopDefaultModelEntry,
  getDesktopModelAllowlistEntry,
  getDesktopModelConfig,
} from './local-model-gateway';

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
          allowed: [getDesktopModelAllowlistEntry(desktopModel)],
          default: getDesktopDefaultModelEntry(desktopModel),
        },
      },
    },
  };
}

export const desktopBuilderAgent = createBuilderAgent({
  model: getDesktopAgentModelConfig(),
});
