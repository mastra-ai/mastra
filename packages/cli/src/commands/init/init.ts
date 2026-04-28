import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps';

import { gitInit } from '../utils';
import { installMastraDocsMCPServer } from './mcp-docs-server-install';
import type { Editor } from './mcp-docs-server-install';
import { provisionObserveProject } from './observe-provision';
import { installMastraSkills } from './skills-install';
import {
  createComponentsDir,
  createMastraDir,
  getAPIKey,
  readPackageName,
  writeAgentsMarkdown,
  writeAPIKey,
  writeClaudeMarkdown,
  writeCodeSample,
  writeIndexFile,
  writeObserveEnv,
} from './utils';
import type { Component, LLMProvider } from './utils';

const s = p.spinner();

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
  observe,
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
  observe?: boolean;
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
      const needsDuckDB = (await depService.checkDependencies(['@mastra/duckdb'])) !== `ok`;
      if (needsDuckDB) {
        await depService.installPackages([`@mastra/duckdb${packageVersionTag}`]);
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

    if (observe) {
      try {
        const defaultProjectName = await readPackageName();
        const result = await provisionObserveProject({ defaultProjectName });
        await writeObserveEnv({ token: result.token, endpoint: result.endpoint });
        p.note(
          `${color.green('Mastra Observe enabled.')}

  Project: ${color.cyan(result.projectName)} (${result.orgName})
  Access token written to ${color.cyan('.env')} as ${color.cyan('MASTRA_CLOUD_ACCESS_TOKEN')}.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        try {
          await writeObserveEnv();
        } catch {}
        p.note(
          `${color.yellow('Could not connect this project to Mastra Observe automatically:')} ${message}

  Empty ${color.cyan('MASTRA_CLOUD_ACCESS_TOKEN')} and ${color.cyan('MASTRA_CLOUD_TRACES_ENDPOINT')} placeholders were added to your ${color.cyan('.env')} file.

  1. Visit ${color.cyan('https://cloud.mastra.ai')} to create a project and mint an access token.
  2. Paste the token into ${color.cyan('MASTRA_CLOUD_ACCESS_TOKEN')} and the spans endpoint into ${color.cyan('MASTRA_CLOUD_TRACES_ENDPOINT')}.`,
        );
      }
    }

    if (!llmApiKey) {
      p.note(`
      ${color.green('Mastra initialized successfully!')}

      Rename ${color.cyan('.env.example')} to ${color.cyan('.env')}
      and add your ${color.cyan(key)}
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
