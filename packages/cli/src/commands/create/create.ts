import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import * as p from '@clack/prompts';
import color from 'picocolors';
import pkgJson from '../../../package.json';
import type { PosthogAnalytics } from '../../analytics/index';
import { getAnalytics } from '../../analytics/index';
import { cloneTemplate, installDependencies } from '../../utils/clone-template';
import { loadTemplates, selectTemplate, findTemplateByName, getDefaultProjectName } from '../../utils/template-utils';
import type { Template } from '../../utils/template-utils';
import { init } from '../init/init';
import type { Editor } from '../init/mcp-docs-server-install';
import type { Component, LLMProvider } from '../init/utils';
import { LLM_PROVIDERS } from '../init/utils';
import { getPackageManager, gitInit } from '../utils.js';

import { createMastraProject } from './utils';

const version = pkgJson.version;

export const create = async (args: {
  projectName?: string;
  components?: Component[];
  llmProvider?: LLMProvider;
  addExample?: boolean;
  llmApiKey?: string;
  createVersionTag?: string;
  timeout?: number;
  directory?: string;
  mcpServer?: Editor;
  template?: string | boolean;
  analytics?: PosthogAnalytics;
}) => {
  if (args.template !== undefined) {
    await createFromTemplate({
      projectName: args.projectName,
      template: args.template,
      timeout: args.timeout,
      injectedAnalytics: args.analytics,
      llmProvider: args.llmProvider,
    });
    return;
  }

  /**
   * We need to explicitly check for undefined instead of using the falsy (!) check because the user might have passed args that are explicitly set to false (in this case, no example code) and we need to distinguish between those and the case where the args were not passed at all.
   */
  const needsInteractive =
    args.components === undefined || args.llmProvider === undefined || args.addExample === undefined;

  const { projectName, result } = await createMastraProject({
    projectName: args?.projectName,
    createVersionTag: args?.createVersionTag,
    timeout: args?.timeout,
    llmProvider: args?.llmProvider,
    llmApiKey: args?.llmApiKey,
    needsInteractive,
  });
  const directory = args.directory || 'src/';

  if (needsInteractive && result) {
    // Track model provider selection from interactive prompt
    const analytics = getAnalytics();
    if (analytics && result?.llmProvider) {
      analytics.trackEvent('cli_model_provider_selected', {
        provider: result.llmProvider,
        selection_method: 'interactive',
      });
    }

    await init({
      ...result,
      llmApiKey: result?.llmApiKey as string | undefined,
      components: ['agents', 'tools', 'workflows', 'scorers'],
      addExample: true,
      versionTag: args.createVersionTag,
    });
    postCreate({ projectName });
    return;
  }

  const { components = [], llmProvider = 'openai', addExample = false, llmApiKey } = args;

  // Track model provider selection from CLI args
  const analytics = getAnalytics();
  if (analytics) {
    analytics.trackEvent('cli_model_provider_selected', {
      provider: llmProvider,
      selection_method: 'cli_args',
    });
  }

  await init({
    directory,
    components,
    llmProvider,
    addExample,
    llmApiKey,
    configureEditorWithDocsMCP: args.mcpServer,
    versionTag: args.createVersionTag,
  });

  postCreate({ projectName });
};

const postCreate = ({ projectName }: { projectName: string }) => {
  const packageManager = getPackageManager();
  p.outro(`
   ${color.green('To start your project:')}

    ${color.cyan('cd')} ${projectName}
    ${color.cyan(`${packageManager} run dev`)}
  `);
};

function isGitHubUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'github.com' && parsedUrl.pathname.split('/').length >= 3;
  } catch {
    return false;
  }
}

async function validateGitHubProject(githubUrl: string): Promise<{ isValid: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // Extract owner and repo from GitHub URL
    const urlParts = new URL(githubUrl).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1]?.replace('.git', ''); // Remove .git if present

    if (!owner || !repo) {
      throw new Error('Invalid GitHub URL format');
    }

    // Try to fetch from main branch first, fallback to master
    const branches = ['main', 'master'];
    let packageJsonContent: string | null = null;
    let indexContent: string | null = null;

    for (const branch of branches) {
      try {
        // Fetch package.json
        const packageJsonUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/package.json`;
        const packageJsonResponse = await fetch(packageJsonUrl);

        if (packageJsonResponse.ok) {
          packageJsonContent = await packageJsonResponse.text();

          // If package.json found, try to fetch index.ts from same branch
          const indexUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/src/mastra/index.ts`;
          const indexResponse = await fetch(indexUrl);

          if (indexResponse.ok) {
            indexContent = await indexResponse.text();
          }

          break; // Found files, no need to check other branches
        }
      } catch {
        // Continue to next branch
      }
    }

    if (!packageJsonContent) {
      errors.push('Could not fetch package.json from repository');
      return { isValid: false, errors };
    }

    // Check for @mastra/core dependency
    try {
      const packageJson = JSON.parse(packageJsonContent);
      const hasMastraCore =
        packageJson.dependencies?.['@mastra/core'] ||
        packageJson.devDependencies?.['@mastra/core'] ||
        packageJson.peerDependencies?.['@mastra/core'];

      if (!hasMastraCore) {
        errors.push('Missing @mastra/core dependency in package.json');
      }
    } catch {
      errors.push('Invalid package.json format');
    }

    // Check for src/mastra/index.ts
    if (!indexContent) {
      errors.push('Missing src/mastra/index.ts file');
    } else {
      // Check if it exports a Mastra instance
      const hasMastraExport =
        indexContent.includes('export') && (indexContent.includes('new Mastra') || indexContent.includes('Mastra('));

      if (!hasMastraExport) {
        errors.push('src/mastra/index.ts does not export a Mastra instance');
      }
    }

    return { isValid: errors.length === 0, errors };
  } catch (error) {
    errors.push(`Failed to validate GitHub repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { isValid: false, errors };
  }
}

async function createFromGitHubUrl(url: string): Promise<Template> {
  // Extract owner and repo from GitHub URL
  const urlParts = new URL(url).pathname.split('/').filter(Boolean);
  const owner = urlParts[0] || 'unknown';
  const repo = urlParts[1] || 'unknown';

  // Create a temporary Template object for GitHub URLs
  return {
    githubUrl: url,
    title: `${owner}/${repo}`,
    slug: repo,
    agents: [],
    mcp: [],
    tools: [],
    networks: [],
    workflows: [],
  };
}

async function createFromTemplate(args: {
  projectName?: string;
  template?: string | boolean;
  timeout?: number;
  injectedAnalytics?: PosthogAnalytics;
  llmProvider?: LLMProvider;
}) {
  let selectedTemplate: Template | undefined;

  if (args.template === true) {
    // Interactive template selection
    const templates = await loadTemplates();
    const selected = await selectTemplate(templates);
    if (!selected) {
      p.log.info('No template selected. Exiting.');
      return;
    }
    selectedTemplate = selected;
  } else if (args.template && typeof args.template === 'string') {
    // Check if it's a GitHub URL
    if (isGitHubUrl(args.template)) {
      // Validate GitHub project before cloning
      const spinner = p.spinner();
      spinner.start('Validating GitHub repository...');

      const validation = await validateGitHubProject(args.template);

      if (!validation.isValid) {
        spinner.stop('Validation failed');
        p.log.error('This does not appear to be a valid Mastra project:');
        validation.errors.forEach(error => p.log.error(`  - ${error}`));
        throw new Error('Invalid Mastra project');
      }

      spinner.stop('Valid Mastra project ✓');
      selectedTemplate = await createFromGitHubUrl(args.template);
    } else {
      // Template name provided, find it from the list
      const templates = await loadTemplates();
      const found = findTemplateByName(templates, args.template);
      if (!found) {
        p.log.error(`Template "${args.template}" not found. Available templates:`);
        templates.forEach((t: Template) => p.log.info(`  - ${t.title} (use: ${t.slug.replace('template-', '')})`));
        throw new Error(`Template "${args.template}" not found`);
      }
      selectedTemplate = found;
    }
  }

  if (!selectedTemplate) {
    throw new Error('No template selected');
  }

  // Get project name
  let projectName = args.projectName;
  if (!projectName) {
    const defaultName = getDefaultProjectName(selectedTemplate);
    const response = await p.text({
      message: 'What is your project name?',
      defaultValue: defaultName,
      placeholder: defaultName,
    });

    if (p.isCancel(response)) {
      p.log.info('Project creation cancelled.');
      return;
    }

    projectName = response as string;
  }

  // Get LLM provider if not specified
  let llmProvider = args.llmProvider;
  if (!llmProvider) {
    const providerResponse = await p.select({
      message: 'Select a default provider:',
      options: LLM_PROVIDERS,
    });

    if (p.isCancel(providerResponse)) {
      p.log.info('Project creation cancelled.');
      return;
    }

    llmProvider = providerResponse as LLMProvider;
  }

  // Handle git initialization for templates
  let initGit = false;
  const gitConfirmResult = await p.confirm({
    message: 'Initialize a new git repository?',
    initialValue: true,
  });

  if (!p.isCancel(gitConfirmResult)) {
    initGit = gitConfirmResult;
  }

  let projectPath: string | null = null;

  try {
    // Track template usage
    const analytics = args.injectedAnalytics || getAnalytics();
    if (analytics) {
      analytics.trackEvent('cli_template_used', {
        template_slug: selectedTemplate.slug,
        template_title: selectedTemplate.title,
      });

      // Track model provider selection
      if (llmProvider) {
        analytics.trackEvent('cli_model_provider_selected', {
          provider: llmProvider,
          selection_method: args.llmProvider ? 'cli_args' : 'interactive',
        });
      }
    }

    const isBeta = version?.includes('beta') ?? false;
    const isMastraTemplate = selectedTemplate.githubUrl.includes('github.com/mastra-ai/');
    const branch = isBeta && isMastraTemplate ? 'beta' : undefined;

    // Clone the template
    projectPath = await cloneTemplate({
      template: selectedTemplate,
      projectName,
      branch,
      llmProvider,
    });

    // Install dependencies
    await installDependencies(projectPath);

    if (initGit) {
      const s = p.spinner();
      try {
        s.start('Initializing git repository');

        await gitInit({ cwd: projectPath });

        s.stop('Git repository initialized');
      } catch {
        s.stop();
      }
    }

    p.note(`
      ${color.green('Mastra template installed!')}

      Add the necessary environment
      variables in your ${color.cyan('.env')} file
      `);

    // Show completion message
    postCreate({ projectName });
  } catch (error) {
    // Clean up: remove the created directory on failure
    if (projectPath) {
      try {
        if (fsSync.existsSync(projectPath)) {
          await fs.rm(projectPath, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        // Log but don't throw - we want to exit with the original error
        console.error(
          `Warning: Failed to clean up project directory: ${cleanupError instanceof Error ? cleanupError.message : 'Unknown error'}`,
        );
      }
    }
    p.log.error(`Failed to create project from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
