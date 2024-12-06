import yoctoSpinner from 'yocto-spinner';

import {
  checkDependencies,
  checkInitialization,
  Components,
  createComponentsDir,
  createMastraDir,
  LLMProvider,
  writeAPIKey,
  writeCodeSample,
  writeIndexFile,
} from './utils.js';

const s = yoctoSpinner();

export async function init({
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
}) {
  s.color = 'yellow';
  showSpinner && s.start('Initializing Mastra');
  const depCheck = await checkDependencies();

  if (depCheck !== 'ok') {
    showSpinner && s.stop(depCheck);
    return;
  }

  const isInitialized = await checkInitialization();

  if (isInitialized) {
    showSpinner && s.stop('Mastra already initialized');
    return;
  }

  try {
    const dirPath = await createMastraDir(directory);
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
}
