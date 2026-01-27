import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps';

import { gitInit } from '../utils';
import { installMastraDocsMCPServer } from './mcp-docs-server-install';
import type { Editor } from './mcp-docs-server-install';
import { createComponentsDir, createMastraDir, getAPIKey, writeAPIKey, writeCodeSample, writeIndexFile } from './utils';
import type { Component, LLMProvider } from './utils';

const s = p.spinner();

export const init = async ({
  directory = 'src/',
  components,
  llmProvider = 'openai',
  llmApiKey,
  addExample = false,
  configureEditorWithDocsMCP,
  versionTag,
  initGit = false,
}: {
  directory?: string;
  components: Component[];
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  addExample?: boolean;
  configureEditorWithDocsMCP?: Editor;
  versionTag?: string;
  initGit?: boolean;
}) => {
  s.start('Initializing Mastra');
  const packageVersionTag = versionTag ? `@${versionTag}` : '';

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
        addScorers: components.includes('scorers'),
      }),
      ...components.map(component => createComponentsDir(dirPath, component)),
      writeAPIKey({ provider: llmProvider, apiKey: llmApiKey }),
    ]);

    if (addExample) {
      await Promise.all([
        ...components.map(component =>
          writeCodeSample(dirPath, component as Component, llmProvider, components as Component[]),
        ),
      ]);

      const depService = new DepsService();

      // Use ensureDependencies to avoid repetitive check-install patterns
      await depService.ensureDependencies([
        { name: '@mastra/libsql', versionTag },
        { name: '@mastra/memory', versionTag, when: components.includes('agents') },
        { name: '@mastra/loggers', versionTag },
        { name: '@mastra/observability', versionTag },
        { name: '@mastra/evals', versionTag, when: components.includes('scorers') },
      ]);
    }

    const key = await getAPIKey(llmProvider || 'openai');

    if (configureEditorWithDocsMCP) {
      await installMastraDocsMCPServer({
        editor: configureEditorWithDocsMCP,
        directory: process.cwd(),
        versionTag,
      });
    }

    s.stop();

    if (initGit) {
      const s = p.spinner();
      try {
        s.start('Initializing git repository');
        await gitInit({ cwd: process.cwd() });
        s.stop('Git repository initialized');
      } catch {
        s.stop();
      }
    }

    if (!llmApiKey) {
      p.note(`
      ${color.green('Mastra initialized successfully!')}

      Add your ${color.cyan(key)} as an environment variable
      in your ${color.cyan('.env')} file
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
