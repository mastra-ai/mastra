import * as p from '@clack/prompts';
import color from 'picocolors';

import { getAnalytics } from '../../analytics/index';
import { cloneTemplate, installDependencies } from '../../utils/clone-template';
import { loadTemplates, selectTemplate, findTemplateByName, getDefaultProjectName } from '../../utils/template-utils';
import type { Template } from '../../utils/template-utils';
import { init } from '../init/init';
import { interactivePrompt } from '../init/utils';
import type { LLMProvider } from '../init/utils';
import { getPackageManager } from '../utils.js';

import { createMastraProject } from './utils';

export const create = async (args: {
  projectName?: string;
  components?: string[];
  llmProvider?: LLMProvider;
  addExample?: boolean;
  llmApiKey?: string;
  createVersionTag?: string;
  timeout?: number;
  directory?: string;
  mcpServer?: 'windsurf' | 'cursor' | 'cursor-global';
  template?: string | boolean;
}) => {
  if (args.template !== undefined) {
    await createFromTemplate(args);
    return;
  }

  const { projectName } = await createMastraProject({
    projectName: args?.projectName,
    createVersionTag: args?.createVersionTag,
    timeout: args?.timeout,
  });
  const directory = args.directory || 'src/';

  // We need to explicitly check for undefined instead of using the falsy (!)
  // check because the user might have passed args that are explicitly set
  // to false (in this case, no example code) and we need to distinguish
  // between those and the case where the args were not passed at all.
  if (args.components === undefined || args.llmProvider === undefined || args.addExample === undefined) {
    const result = await interactivePrompt();

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
      llmApiKey: result?.llmApiKey as string,
      components: ['agents', 'tools', 'workflows'],
      addExample: true,
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

async function createFromTemplate(args: { projectName?: string; template?: string | boolean; timeout?: number }) {
  const templates = await loadTemplates();
  let selectedTemplate;

  if (args.template === true) {
    selectedTemplate = await selectTemplate(templates);
    if (!selectedTemplate) {
      p.log.info('No template selected. Exiting.');
      return;
    }
  } else if (args.template) {
    // Template name provided, find it
    selectedTemplate = findTemplateByName(templates, args.template);
    if (!selectedTemplate) {
      p.log.error(`Template "${args.template}" not found. Available templates:`);
      templates.forEach((t: Template) => p.log.info(`  - ${t.title} (use: ${t.slug.replace('template-', '')})`));
      throw new Error(`Template "${args.template}" not found`);
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

  try {
    // Track template usage
    const analytics = getAnalytics();
    if (analytics) {
      analytics.trackEvent('cli_template_used', {
        template_slug: selectedTemplate.slug,
        template_title: selectedTemplate.title,
      });
    }

    // Clone the template
    const projectPath = await cloneTemplate({
      template: selectedTemplate,
      projectName,
    });

    // Install dependencies
    await installDependencies(projectPath);

    p.note(`
      ${color.green('Mastra template installed!')}

      Add the necessary environment 
      variables in your ${color.cyan('.env')} file
      `);

    // Show completion message
    postCreate({ projectName });
  } catch (error) {
    p.log.error(`Failed to create project from template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
