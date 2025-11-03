import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps';

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
}: {
  directory?: string;
  components: Component[];
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  addExample?: boolean;
  configureEditorWithDocsMCP?: Editor;
  versionTag?: string;
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

      const needsLibsql = (await depService.checkDependencies(['@mastra/libsql'])) !== `ok`;
      if (needsLibsql) {
        await depService.installPackages([`@mastra/libsql${packageVersionTag}`]);
      }
      const needsMemory =
        components.includes(`agents`) && (await depService.checkDependencies(['@mastra/memory'])) !== `ok`;
      if (needsMemory) {
        await depService.installPackages([`@mastra/memory${packageVersionTag}`]);
      }

      const needsLoggers = (await depService.checkDependencies(['@mastra/loggers'])) !== `ok`;
      if (needsLoggers) {
        await depService.installPackages([`@mastra/loggers${packageVersionTag}`]);
      }

      const needsObservability = (await depService.checkDependencies(['@mastra/observability'])) !== `ok`;
      if (needsObservability) {
        await depService.installPackages([`@mastra/observability${packageVersionTag}`]);
      }

      const needsEvals =
        components.includes(`scorers`) && (await depService.checkDependencies(['@mastra/evals'])) !== `ok`;
      if (needsEvals) {
        await depService.installPackages([`@mastra/evals${packageVersionTag}`]);
      }
    }

    const key = await getAPIKey(llmProvider || 'openai');

    if (configureEditorWithDocsMCP) {
      await installMastraDocsMCPServer({
        editor: configureEditorWithDocsMCP,
        directory: process.cwd(),
      });
    }

    s.stop();
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
