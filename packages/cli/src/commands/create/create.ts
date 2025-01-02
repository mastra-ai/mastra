import * as p from '@clack/prompts';

import { init } from '../init/init.js';
import { interactivePrompt, LLMProvider } from '../init/utils.js';

import { createMastraProject } from './utils.js';

export const create = async (args: { components?: string[]; llmProvider?: LLMProvider; addExample?: boolean }) => {
  const { projectName } = await createMastraProject();
  const directory = '/src';

  if (!args.components || !args.llmProvider || !args.addExample) {
    const result = await interactivePrompt();
    await init({
      ...result,
    });
    postCreate({ projectName });
    return;
  }

  const { components = [], llmProvider = 'openai', addExample = false } = args;

  await init({
    directory,
    components,
    llmProvider,
    addExample,
  });

  postCreate({ projectName });
};

const postCreate = ({ projectName }: { projectName: string }) => {
  p.note(`
    To start your project
    cd ${projectName}
    npx mastra dev
    `);
};
