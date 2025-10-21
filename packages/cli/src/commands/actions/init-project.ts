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
    // @ts-expect-error: TODO - Fix this
    args,
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

      const componentsArr = args.components ? args.components : [];
      await init({
        directory: args.dir,
        components: componentsArr,
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
