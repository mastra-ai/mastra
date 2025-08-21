import { analytics } from '../..';
import type { CLI_ORIGIN } from '../../analytics';
import { init } from '../init/init';
import { checkAndInstallCoreDeps, checkPkgJson, interactivePrompt } from '../init/utils';

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

export const initProject = async (args: any) => {
  await analytics.trackCommandExecution({
    command: 'init',
    args,
    execution: async () => {
      await checkPkgJson();
      await checkAndInstallCoreDeps(args?.example || args?.default);

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

      const componentsArr = args.components ? args.components.split(',') : [];
      await init({
        directory: args.dir,
        components: componentsArr,
        llmProvider: args.llm,
        addExample: args.example,
        llmApiKey: args['llm-api-key'],
        configureEditorWithDocsMCP: args.mcp,
      });
      return;
    },
    origin,
  });
};
