import * as p from '@clack/prompts';
import color from 'picocolors';

import { init } from '../init/init';
import { interactivePrompt } from '../init/utils';
import type { LLMProvider } from '../init/utils';

import { createMastraProject } from './utils';

export const create = async (args: {
  projectName?: string;
  components?: string[];
  llmProvider?: LLMProvider;
  addExample?: boolean;
  llmApiKey?: string;
  createVersionTag?: string;
  timeout?: number;
}) => {
  const { projectName } = await createMastraProject({
    projectName: args?.projectName,
    createVersionTag: args?.createVersionTag,
    timeout: args?.timeout,
  });
  const directory = '/src';

  if (!args.components || !args.llmProvider || !args.addExample) {
    const result = await interactivePrompt();
    await init({
      ...result,
      llmApiKey: result?.llmApiKey as string,
    });
    postCreate({ projectName });
    return;
  }

  const { components = [], llmProvider = 'openai', addExample = false, llmApiKey } = args;

  await init({
    directory,
    components,
    llmProvider,
    addExample,
    llmApiKey,
  });

  postCreate({ projectName });
};

const postCreate = ({ projectName }: { projectName: string }) => {
  p.outro(`
   ${color.green('To start your project:')}

    ${color.cyan('cd')} ${projectName}
    ${color.cyan('npm run dev')}
  `);
};
