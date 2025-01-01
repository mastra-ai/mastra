import * as p from '@clack/prompts';
import color from 'picocolors';

import {
  Components,
  createComponentsDir,
  createMastraDir,
  LLMProvider,
  writeAPIKey,
  writeCodeSample,
  writeIndexFile,
} from './utils.js';

const s = p.spinner();

export const init = async ({
  directory,
  addExample = false,
  components,
  llmProvider = 'openai',
}: {
  directory: string;
  components: string[];
  llmProvider: LLMProvider;
  addExample: boolean;
}) => {
  s.start('Initializing Mastra');

  try {
    const result = await createMastraDir(directory);

    if (!result.ok) {
      p.outro(color.inverse(' Mastra already initialized '));
      s.stop();
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
    s.stop();
    p.outro(' Mastra initialized successfully');
    return { success: true };
  } catch (err) {
    s.stop();
    p.outro(color.inverse(' Could not initialize mastra '));
    console.error(err);
    return { success: false };
  }
};
