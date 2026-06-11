import * as p from '@clack/prompts';
import color from 'picocolors';

import { DepsService } from '../../services/service.deps';

import { gitInit } from '../utils';
import { installMastraDocsMCPServer } from './mcp-docs-server-install';
import type { Editor } from './mcp-docs-server-install';
import { provisionObservabilityProject } from './observability-provision';
import { installMastraSkills } from './skills-install';
import {
  createComponentsDir,
  createMastraDir,
  getAPIKey,
  readPackageName,
  writeAgentBuilderIndexFile,
  writeAgentsMarkdown,
  writeAPIKey,
  writeClaudeMarkdown,
  writeCodeSample,
  writeIndexFile,
  writeObservabilityEnv,
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
  observability,
  observabilityProject,
  observabilityMode = 'pick',
  observabilityToken,
  observabilityOrgId,
  observabilityOrgName,
  agentBuilder = false,
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
  observability?: boolean;
  observabilityProject?: string;
  observabilityToken?: string;
  observabilityOrgId?: string;
  observabilityOrgName?: string;
  /**
   * `'create'` skips the project picker and always provisions a new platform
   * project named after the local one (used by `create-mastra`). `'pick'`
   * shows the existing-or-new project picker (used by `mastra init`).
   */
  observabilityMode?: 'create' | 'pick';
  /** Scaffold the project for Agent Builder instead of the default agent template. */
  agentBuilder?: boolean;
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

    if (agentBuilder) {
      await Promise.all([
        writeAgentBuilderIndexFile({ dirPath }),
        writeAPIKey({ provider: 'openai', apiKey: llmApiKey }),
      ]);
    } else {
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
    }

    if (agentBuilder) {
      const depService = new DepsService();
      const agentBuilderDeps = [
        '@mastra/core',
        '@mastra/editor',
        '@mastra/libsql',
        '@mastra/duckdb',
        '@mastra/observability',
      ];
      const missing = (
        await Promise.all(
          agentBuilderDeps.map(async dep => {
            const status = await depService.checkDependencies([dep]);
            return status !== 'ok' ? dep : null;
          }),
        )
      ).filter(Boolean) as string[];
      if (missing.length > 0) {
        await depService.installPackages(missing.map(dep => `${dep}${packageVersionTag}`));
      }
    } else if (addExample) {
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

    if (observability) {
      try {
        const defaultProjectName = await readPackageName();
        const result = await provisionObservabilityProject({
          defaultProjectName,
          observabilityProject,
          mode: observabilityMode,
          token: observabilityToken,
          org:
            observabilityOrgId && observabilityOrgName
              ? { orgId: observabilityOrgId, orgName: observabilityOrgName }
              : undefined,
        });
        await writeObservabilityEnv({
          token: result.token,
          projectId: result.projectId,
          endpoint: result.tracesEndpoint,
        });
        p.note(
          `${color.green('Mastra Observability enabled.')}

  Project: ${color.cyan(result.projectName)} (${result.orgName})
  Wrote ${color.cyan('MASTRA_PLATFORM_ACCESS_TOKEN')} and ${color.cyan('MASTRA_PROJECT_ID')} to ${color.cyan('.env')}.`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        try {
          await writeObservabilityEnv();
        } catch {}
        p.note(
          `${color.yellow('Could not connect this project to Mastra Observability automatically:')} ${message}

  Empty ${color.cyan('MASTRA_PLATFORM_ACCESS_TOKEN')} and ${color.cyan('MASTRA_PROJECT_ID')} placeholders were added to your ${color.cyan('.env')} file.

  1. Visit ${color.cyan('https://projects.mastra.ai')} to create a project and an access token.
  2. Paste the token into ${color.cyan('MASTRA_PLATFORM_ACCESS_TOKEN')} and the project id into ${color.cyan('MASTRA_PROJECT_ID')}.`,
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
