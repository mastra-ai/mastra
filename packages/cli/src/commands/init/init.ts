import yoctoSpinner from 'yocto-spinner';

import { logger } from '../../utils/logger.js';

import {
  checkDependencies,
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
  showSpinner = false,
}: {
  directory: string;
  components: string[];
  llmProvider: LLMProvider;
  addExample: boolean;
  showSpinner?: boolean;
}) => {
  s.color = 'yellow';

  showSpinner && s.start('Initializing Mastra');
  const depCheck = await checkDependencies();

  if (depCheck !== 'ok') {
    if (showSpinner) {
      showSpinner && s.stop(depCheck);
    } else {
      logger.log(depCheck);
    }
    process.exit(0);
  }

  try {
    const result = await createMastraDir(directory);

    if (!result.ok) {
      s.stop('Mastra already initialized.');
      process.exit(0);
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
