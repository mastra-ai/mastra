#! /usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import type { PackageJson } from 'type-fest';

import pkgJson from '../package.json';
import type { CLI_ORIGIN } from './analytics/index';
import { PosthogAnalytics, setAnalytics } from './analytics/index';
import { addScorer } from './commands/actions/add-scorer';
import { buildProject } from './commands/actions/build-project';
import { createProject } from './commands/actions/create-project';
import { deployProject } from './commands/actions/deploy-project';
import { initProject } from './commands/actions/init-project';
import { lintProject } from './commands/actions/lint-project';
import { listScorers } from './commands/actions/list-scorers';
import { startDevServer } from './commands/actions/start-dev-server';
import { startProject } from './commands/actions/start-project';

const mastraPkg = pkgJson as PackageJson;
export const version = mastraPkg.version;

export const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: version!,
});

setAnalytics(analytics);

const program = new Command();

export const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

program
  .name('mastra')
  .version(`${version}`, '-v, --version')
  .addHelpText(
    'before',
    `
${pc.bold(pc.cyan('Mastra'))} is a typescript framework for building AI applications, agents, and workflows.
`,
  )
  .action(() => {
    program.help();
  });

program
  .command('create [project-name]')
  .description('Create a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, examples)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, groq, google, cerebras or mistral)')
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .option('-n, --no-example', 'Do not include example code')
  .option('-t, --timeout [timeout]', 'Configurable timeout for package installation, defaults to 60000 ms')
  .option('-d, --dir <directory>', 'Target directory for Mastra source code (default: src/)')
  .option(
    '-p, --project-name <string>',
    'Project name that will be used in package.json and as the project directory name.',
  )
  .option('-m, --mcp <editor>', 'MCP Server for code editor (cursor, cursor-global, windsurf, vscode)')
  .option(
    '--template [template-name]',
    'Create project from a template (use template name, public GitHub URL, or leave blank to select from list)',
  )
  .action(createProject);

program
  .command('init')
  .description('Initialize Mastra in your project')
  .option('--default', 'Quick start with defaults(src, OpenAI, examples)')
  .option('-d, --dir <directory>', 'Directory for Mastra files to (defaults to src/)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, groq, google or cerebras))')
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .option('-n, --no-example', 'Do not include example code')
  .option('-m, --mcp <editor>', 'MCP Server for code editor (cursor, cursor-global, windsurf, vscode)')
  .action(initProject);

program
  .command('lint')
  .description('Lint your Mastra project')
  .option('-d, --dir <path>', 'Path to your Mastra folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .action(lintProject);

program
  .command('dev')
  .description('Start mastra server')
  .option('-d, --dir <dir>', 'Path to your mastra folder')
  .option('-r, --root <root>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-p, --port <port>', 'deprecated: Port number for the development server (defaults to 4111)')
  .option('-e, --env <env>', 'Custom env file to include in the dev server')
  .option('-i, --inspect', 'Start the dev server in inspect mode')
  .option('-b, --inspect-brk', 'Start the dev server in inspect mode and break at the beginning of the script')
  .option(
    '-c, --custom-args <args>',
    'Comma-separated list of custom arguments to pass to the dev server. IE: --experimental-transform-types',
  )
  .option('-s, --https', 'Enable local HTTPS')
  .action(startDevServer);

program
  .command('build')
  .description('Build your Mastra project')
  .option('-d, --dir <path>', 'Path to your Mastra Folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-e, --env <env>', 'Custom env file to include in the build')
  .action(buildProject);

program
  .command('deploy')
  .description('Deploy your Mastra project')
  .option('-d, --dir <path>', 'Path to directory')
  .action(deployProject);

program
  .command('start')
  .description('Start your built Mastra application')
  .option('-d, --dir <path>', 'Path to your built Mastra output directory (default: .mastra/output)')
  .option('-e, --env <env>', 'Custom env file to include in the start')
  .option('-nt, --no-telemetry', 'Disable telemetry on start')
  .action(startProject);

const scorersCommand = program.command('scorers').description('Manage scorers for evaluating AI outputs');

scorersCommand
  .command('add [scorer-name]')
  .description('Add a new scorer to your project')
  .option('-d, --dir <path>', 'Path to your Mastra directory (default: auto-detect)')
  .action(addScorer);

scorersCommand.command('list').description('List available scorer templates').action(listScorers);

program.parse(process.argv);

export { PosthogAnalytics } from './analytics/index';
export { create } from './commands/create/create';
