import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { init } from '../init/init';
import { checkAndInstallCoreDeps, checkForPkgJson, interactivePrompt } from '../init/utils';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

interface InitArgs {
  default?: boolean;
  dir?: string;
  components?: string;
  llm?: string;
  llmApiKey?: string;
  example?: boolean;
  mcp?: string;
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
          // @ts-expect-error: TODO - Fix this
          configureEditorWithDocsMCP: args.mcp,
        });
        return;
      }

      const componentsArr = args.components ? args.components.split(',') : [];
      await init({
        directory: args.dir,
        components: componentsArr,
        // @ts-expect-error: TODO - Fix this
        llmProvider: args.llm,
        addExample: args.example,
        llmApiKey: args.llmApiKey,
        // @ts-expect-error: TODO - Fix this
        configureEditorWithDocsMCP: args.mcp,
      });
      return;
    },
    origin,
  });
};
