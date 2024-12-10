import yoctoSpinner from 'yocto-spinner';

import { DepsService } from '../../services/service.deps.js';

import {
  Components,
  createComponentsDir,
  createMastraDir,
  LLMProvider,
  writeAPIKey,
  writeCodeSample,
  writeIndexFile,
} from './utils.js';

const s = yoctoSpinner();

export const init = async ({
  directory,
  addExample = false,
  components,
  llmProvider = 'openai',
  showSpinner,
}: {
  directory: string;
  components: string[];
  llmProvider: LLMProvider;
  addExample: boolean;
  showSpinner?: boolean;
}) => {
  s.color = 'yellow';
  showSpinner && s.start('Initializing Mastra');

  const depsService = new DepsService();
  const depCheck = await depsService.checkDependencies(['@mastra/core']); // Example dependencies

  if (depCheck !== 'ok') {
    showSpinner && s.stop(depCheck);
    return;
  }

  try {
    const result = await createMastraDir(directory);

    if (!result.ok) {
      s.stop('Mastra already initialized.');
      return;
    }
    const dirPath = result.dirPath;
    await Promise.all([
      writeIndexFile(dirPath, addExample),
      ...components.map(component => createComponentsDir(dirPath, component)),
      writeAPIKey(llmProvider),
    ]);

    if (addExample) {
      await Promise.all([components.map(component => writeCodeSample(dirPath, component as Components, llmProvider))]);
    }
    showSpinner && s.success('Mastra initialized successfully');
  } catch (err) {
    showSpinner && s.stop('Could not initialize mastra');
    console.error(err);
  }
};
