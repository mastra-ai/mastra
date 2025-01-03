import * as p from '@clack/prompts';
import color from 'picocolors';

import {
  Components,
  createComponentsDir,
  createMastraDir,
  getAPIKey,
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
      s.stop(color.inverse(' Mastra already initialized '));
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

    const key = await getAPIKey(llmProvider || 'openai');

    s.stop();
    p.note(`
      ${color.green('Mastra initialized successfully!')}

      Add your ${color.cyan(key)} as an environment variable
      in your ${color.cyan('.env.development')} file
      `);
    return { success: true };
  } catch (err) {
    s.stop(color.inverse('An error occurred while initializing Mastra'));
    console.error(err);
    return { success: false };
  }
};
