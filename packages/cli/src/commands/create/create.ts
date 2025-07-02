import * as p from '@clack/prompts';
import color from 'picocolors';

import { init } from '../init/init';
import { interactivePrompt } from '../init/utils';
import type { LLMProvider } from '../init/utils';
import { getPackageManager } from '../utils.js';

import { createMastraProject } from './utils';

export const create = async (args: {
  projectName?: string;
  components?: string[];
  llmProvider?: LLMProvider;
  addExample?: boolean;
  llmApiKey?: string;
  createVersionTag?: string;
  timeout?: number;
  directory?: string;
  mcpServer?: 'windsurf' | 'cursor' | 'cursor-global';
}) => {
  const { projectName } = await createMastraProject({
    projectName: args?.projectName,
    createVersionTag: args?.createVersionTag,
    timeout: args?.timeout,
  });
  const directory = args.directory || 'src/';

  // We need to explicitly check for undefined instead of using the falsy (!)
  // check because the user might have passed args that are explicitly set
  // to false (in this case, no example code) and we need to distinguish
  // between those and the case where the args were not passed at all.
  if (args.components === undefined || args.llmProvider === undefined || args.addExample === undefined) {
    const result = await interactivePrompt();
    await init({
      ...result,
      llmApiKey: result?.llmApiKey as string,
      components: ['agents', 'tools', 'workflows'],
      addExample: true,
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
    configureEditorWithDocsMCP: args.mcpServer,
  });

  postCreate({ projectName });
};

const postCreate = ({ projectName }: { projectName: string }) => {
  const packageManager = getPackageManager();
  p.outro(`
   ${color.green('To start your project:')}

    ${color.cyan('cd')} ${projectName}
    ${color.cyan(`${packageManager} run dev`)}
  `);
};
