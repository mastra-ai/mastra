import { DepsService } from '../../services/service.deps.js';
import { logger } from '../../utils/logger.js';

import {
  Components,
  createComponentsDir,
  createMastraDir,
  LLMProvider,
  writeAPIKey,
  writeCodeSample,
  writeIndexFile,
} from './utils.js';

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
  const depsService = new DepsService();
  const depCheck = await depsService.checkDependencies(['@mastra/core']);

  if (depCheck !== 'ok') {
    logger.error(depCheck);
    return { success: false };
  }

  try {
    const result = await createMastraDir(directory);

    if (!result.ok) {
      logger.info('Mastra already initialized');
      return { success: false };
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
    showSpinner && logger.success('Mastra initialized successfully');
    return { success: true };
  } catch (err) {
    showSpinner && logger.error('Could not initialize mastra');
    console.error(err);
    return { success: false };
  }
};
