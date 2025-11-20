import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { init } from '../init/init';
import type { Editor } from '../init/mcp-docs-server-install';
import { checkAndInstallCoreDeps, checkForPkgJson, interactivePrompt } from '../init/utils';
import type { Component, LLMProvider } from '../init/utils';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

interface InitArgs {
  default?: boolean;
  dir?: string;
  components?: Component[];
  llm?: LLMProvider;
  llmApiKey?: string;
  example?: boolean;
  mcp?: Editor;
}

export const initProject = async (args: InitArgs) => {
  await analytics.trackCommandExecution({
    command: 'init',
    args: { ...args },
    execution: async () => {
      await checkForPkgJson();
      await checkAndInstallCoreDeps(Boolean(args?.example || args?.default));

      if (!Object.keys(args).length) {
        const result = await interactivePrompt();
        await init({
          ...result,
          llmApiKey: result?.llmApiKey as string,
          components: ['agents', 'tools', 'workflows'],
          addExample: true,
        });
        return;
      }

      if (args?.default) {
        await init({
          directory: 'src/',
          components: ['agents', 'tools', 'workflows'],
          llmProvider: 'openai',
          addExample: true,
          configureEditorWithDocsMCP: args.mcp,
        });
        return;
      }

      await init({
        directory: args.dir,
        components: args.components ? args.components : [],
        llmProvider: args.llm,
        addExample: args.example,
        llmApiKey: args.llmApiKey,
        configureEditorWithDocsMCP: args.mcp,
      });
      return;
    },
    origin,
  });
};
