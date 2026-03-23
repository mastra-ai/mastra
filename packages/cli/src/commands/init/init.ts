import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps';

import { gitInit } from '../utils';
import { installMastraDocsMCPServer } from './mcp-docs-server-install';
import type { Editor } from './mcp-docs-server-install';
import { installMastraSkills } from './skills-install';
import {
  createComponentsDir,
  createMastraDir,
  getAPIKey,
  writeAgentsMarkdown,
  writeAPIKey,
  writeClaudeMarkdown,
  writeCodeSample,
  writeGatewaySharedFile,
  writeIndexFile,
} from './utils';
import type { Component, ConnectionMethod, LLMProvider } from './utils';

const s = p.spinner();

async function installWithFallback(depService: DepsService, pkg: string, versionTag: string) {
  try {
    await depService.installPackages([`${pkg}${versionTag}`]);
  } catch {
    if (versionTag && versionTag !== '@latest') {
      await depService.installPackages([`${pkg}@latest`]);
    } else {
      throw new Error(`Failed to install ${pkg}`);
    }
  }
}

export const init = async ({
  directory = 'src/',
  components,
  llmProvider = 'openai',
  llmApiKey,
  addExample = false,
  skills,
  mcpServer,
  versionTag,
  initGit = false,
  connectionMethod = 'direct',
}: {
  directory?: string;
  components: Component[];
  llmProvider?: LLMProvider;
  llmApiKey?: string;
  addExample?: boolean;
  skills?: string[];
  mcpServer?: Editor;
  versionTag?: string;
  initGit?: boolean;
  connectionMethod?: ConnectionMethod;
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

    const initTasks: Promise<unknown>[] = [
      writeIndexFile({
        dirPath,
        addExample,
        addWorkflow: components.includes('workflows'),
        addAgent: components.includes('agents'),
        addScorers: components.includes('scorers'),
      }),
      ...components.map(component => createComponentsDir(dirPath, component)),
    ];

    if (connectionMethod !== 'gateway') {
      initTasks.push(writeAPIKey({ provider: llmProvider, apiKey: llmApiKey }));
    }

    if (connectionMethod === 'gateway') {
      initTasks.push(writeGatewaySharedFile(dirPath));
    }

    await Promise.all(initTasks);

    if (addExample) {
      await Promise.all([
        ...components.map(component =>
          writeCodeSample(dirPath, component as Component, llmProvider, components as Component[], connectionMethod),
        ),
      ]);

      const depService = new DepsService();

      const needsLibsql = (await depService.checkDependencies(['@mastra/libsql'])) !== `ok`;
      if (needsLibsql) {
        await installWithFallback(depService, '@mastra/libsql', packageVersionTag);
      }
      if (connectionMethod !== 'gateway') {
        const needsMemory =
          components.includes(`agents`) && (await depService.checkDependencies(['@mastra/memory'])) !== `ok`;
        if (needsMemory) {
          await installWithFallback(depService, '@mastra/memory', packageVersionTag);
        }
      }

      const needsLoggers = (await depService.checkDependencies(['@mastra/loggers'])) !== `ok`;
      if (needsLoggers) {
        await installWithFallback(depService, '@mastra/loggers', packageVersionTag);
      }

      const needsObservability = (await depService.checkDependencies(['@mastra/observability'])) !== `ok`;
      if (needsObservability) {
        await installWithFallback(depService, '@mastra/observability', packageVersionTag);
      }

      const needsEvals =
        components.includes(`scorers`) && (await depService.checkDependencies(['@mastra/evals'])) !== `ok`;
      if (needsEvals) {
        await installWithFallback(depService, '@mastra/evals', packageVersionTag);
      }

      if (connectionMethod === 'gateway') {
        const needsOpenAICompat = (await depService.checkDependencies(['@ai-sdk/openai-compatible'])) !== `ok`;
        if (needsOpenAICompat) {
          await depService.installPackages(['@ai-sdk/openai-compatible']);
        }
      }
    }

    s.stop('Mastra initialized');

    // Install skills if selected
    if (skills && skills.length > 0) {
      try {
        s.start('Installing Mastra agent skills');
        const skillsResult = await installMastraSkills({
          directory: process.cwd(),
          agents: skills,
        });
        if (skillsResult.success) {
          // Format agent names nicely
          const agentNames = skillsResult.agents
            .map(agent => {
              // Convert kebab-case to Title Case
              return agent
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            })
            .join(', ');
          s.stop(`Mastra agent skills installed (in ${agentNames})`);
        } else {
          s.stop('Skills installation failed');
          console.warn(color.yellow(`\nWarning: ${skillsResult.error}`));
        }
      } catch (error) {
        s.stop('Skills installation failed');
        console.warn(color.yellow(`\nWarning: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }

    // Install MCP if an editor was selected
    if (mcpServer) {
      await installMastraDocsMCPServer({
        editor: mcpServer,
        directory: process.cwd(),
        versionTag,
      });
    }

    // Write AGENTS.md and CLAUDE.md if skills or MCP were configured
    if ((skills && skills.length > 0) || mcpServer) {
      try {
        // Always write AGENTS.md
        await writeAgentsMarkdown({ skills, mcpServer });

        // Write CLAUDE.md only if claude-code is in skills list
        const shouldWriteClaudeMd = skills?.includes('claude-code');
        if (shouldWriteClaudeMd) {
          await writeClaudeMarkdown();
        }
      } catch (error) {
        // Don't fail initialization if markdown files fail to write
        console.warn(
          color.yellow(
            `\nWarning: Failed to create agent guide files: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }
    }

    if (initGit) {
      s.start('Initializing git repository');
      try {
        await gitInit({ cwd: process.cwd() });
        s.stop('Git repository initialized');
      } catch {
        s.stop();
      }
    }

    if (connectionMethod === 'gateway') {
      p.note(`
      ${color.green('Mastra initialized successfully!')}

      ${color.cyan('GATEWAY_URL')} and ${color.cyan('GATEWAY_API_KEY')} have been written to your ${color.cyan('.env')} file
      `);
    } else if (!llmApiKey) {
      const key = await getAPIKey(llmProvider || 'openai');
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
