import * as p from '@clack/prompts';
import child_process from 'node:child_process';
import util from 'node:util';
import color from 'picocolors';

import {
  type Components,
  createComponentsDir,
  createMastraDir,
  getAISDKPackage,
  getAPIKey,
  type LLMProvider,
  writeAPIKey,
  writeCodeSample,
  writeIndexFile,
} from './utils';

const s = p.spinner();

const exec = util.promisify(child_process.exec);

export const init = async ({
  directory,
  addExample = false,
  components,
  llmProvider = 'openai',
  llmApiKey,
}: {
  directory: string;
  components: string[];
  llmProvider: LLMProvider;
  addExample: boolean;
  llmApiKey?: string;
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
      writeIndexFile({
        dirPath,
        addExample,
        addWorkflow: components.includes('workflows'),
        addAgent: components.includes('agents'),
      }),
      ...components.map(component => createComponentsDir(dirPath, component)),
      writeAPIKey({ provider: llmProvider, apiKey: llmApiKey }),
    ]);

    if (addExample) {
      await Promise.all([
        ...components.map(component =>
          writeCodeSample(dirPath, component as Components, llmProvider, components as Components[]),
        ),
      ]);
    }

    const key = await getAPIKey(llmProvider || 'openai');

    const aiSdkPackage = getAISDKPackage(llmProvider);
    await exec(`npm i ${aiSdkPackage}`);

    s.stop();
    if (!llmApiKey) {
      p.note(`
      ${color.green('Mastra initialized successfully!')}

      Add your ${color.cyan(key)} as an environment variable
      in your ${color.cyan('.env.development')} file
      `);
    } else {
      p.note(`
      ${color.green('Mastra initialized successfully!')}
      `);
    }
    return { success: true };
  } catch (err) {
    s.stop(color.inverse('An error occurred while initializing Mastra'));
    console.error(err);
    return { success: false };
  }
};
