#! /usr/bin/env node
import { coreFeatures } from '@mastra/core/features';
import { Command } from 'commander';
import pc from 'picocolors';
import type { PackageJson } from 'type-fest';

import pkgJson from '../package.json';
import type { CLI_ORIGIN } from './analytics/index';
import { PosthogAnalytics, setAnalytics } from './analytics/index';
import { addScorer } from './commands/actions/add-scorer';
import { buildProject } from './commands/actions/build-project';
import { createProject } from './commands/actions/create-project';
import { initProject } from './commands/actions/init-project';
import { lintProject } from './commands/actions/lint-project';
import { listScorers } from './commands/actions/list-scorers';
import { migrate } from './commands/actions/migrate';
import { startDevServer } from './commands/actions/start-dev-server';
import { startProject } from './commands/actions/start-project';
import { startStudio } from './commands/actions/start-studio';
import { loginAction, logoutAction } from './commands/auth/login';
import { listOrgsAction, switchOrgAction } from './commands/auth/orgs';
import { createTokenAction, listTokensAction, revokeTokenAction } from './commands/auth/tokens';
import { whoamiAction } from './commands/auth/whoami';
import { COMPONENTS, LLMProvider } from './commands/init/utils';
import { serverDeployAction } from './commands/server/deploy';
import { serverSuggestionsAction } from './commands/server/deploy-suggestions';
import { envListAction, envSetAction, envUnsetAction, envImportAction, envPullAction } from './commands/server/env';
import { serverPauseAction, serverRestartAction } from './commands/server/lifecycle';
import { deployAction } from './commands/studio/deploy';
import { deploysAction } from './commands/studio/deploy-list';
import { logsAction } from './commands/studio/deploy-logs';
import { statusAction } from './commands/studio/deploy-status';
import { suggestionsAction } from './commands/studio/deploy-suggestions';
import { listProjectsAction, createProjectAction } from './commands/studio/projects';
import { parseComponents, parseLlmProvider, parseMcp, parseSkills } from './commands/utils';

function wrapAction(fn: (...args: any[]) => Promise<void>): (...args: any[]) => void {
  return (...args: any[]) => {
    fn(...args).catch((err: Error) => {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    });
  };
}

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
  .option('--default', 'Quick start with defaults (src, OpenAI, examples)')
  .option(
    '-c, --components <components>',
    `Comma-separated list of components (${COMPONENTS.join(', ')})`,
    parseComponents,
  )
  .option('-l, --llm <model-provider>', `Default model provider (${LLMProvider.join(', ')})`, parseLlmProvider)
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .option('-n, --no-example', 'Do not include example code')
  .option('-t, --timeout [timeout]', 'Configurable timeout for package installation, defaults to 60000 ms')
  .option('-d, --dir <directory>', 'Target directory for Mastra source code (default: src/)')
  .option(
    '-p, --project-name <string>',
    'Project name that will be used in package.json and as the project directory name.',
  )
  .option(
    '-m, --mcp <editor>',
    'MCP Server for code editor (cursor, cursor-global, windsurf, vscode, antigravity)',
    parseMcp,
  )
  .option('--skills <agents>', 'Install Mastra agent skills for specified agents (comma-separated)', parseSkills)
  .option(
    '--template [template-name]',
    'Create project from a template (use template name, public GitHub URL, or leave blank to select from list)',
  )
  .action(createProject);

program
  .command('init')
  .description('Initialize Mastra in your project')
  .option('--default', 'Quick start with defaults (src, OpenAI, examples)')
  .option('-d, --dir <directory>', 'Directory for Mastra files to (defaults to src/)')
  .option(
    '-c, --components <components>',
    `Comma-separated list of components (${COMPONENTS.join(', ')})`,
    parseComponents,
  )
  .option('-l, --llm <model-provider>', `Default model provider (${LLMProvider.join(', ')})`, parseLlmProvider)
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .option('-n, --no-example', 'Do not include example code')
  .option(
    '-m, --mcp <editor>',
    'MCP Server for code editor (cursor, cursor-global, windsurf, vscode, antigravity)',
    parseMcp,
  )
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
  .option('-e, --env <env>', 'Custom env file to include in the dev server')
  .option(
    '-i, --inspect [host:port]',
    'Start the dev server in inspect mode (optional: [host:]port, e.g., 0.0.0.0:9229)',
  )
  .option(
    '-b, --inspect-brk [host:port]',
    'Start the dev server in inspect mode and break at the beginning of the script (optional: [host:]port)',
  )
  .option(
    '-c, --custom-args <args>',
    'Comma-separated list of custom arguments to pass to the dev server. IE: --experimental-transform-types',
  )
  .option('-s, --https', 'Enable local HTTPS')
  .option('--request-context-presets <file>', 'Path to request context presets JSON file')
  .option('--debug', 'Enable debug logs', false)
  .action(startDevServer);

program
  .command('build')
  .description('Build your Mastra project')
  .option('-d, --dir <path>', 'Path to your Mastra Folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-s, --studio', 'Bundle the studio UI with the build')
  .option('--debug', 'Enable debug logs', false)
  .action(buildProject);

program
  .command('start')
  .description('Start your built Mastra application')
  .option('-d, --dir <path>', 'Path to your built Mastra output directory (default: .mastra/output)')
  .option('-e, --env <env>', 'Custom env file to include in the start')
  .option(
    '-c, --custom-args <args>',
    'Comma-separated list of custom arguments to pass to the Node.js process. IE: --require=newrelic',
  )
  .action(startProject);

const studioCommand = program
  .command('studio')
  .description('Manage Mastra Studio')
  .option('-p, --port <port>', 'Port to run the studio on (default: 3000)')
  .option('-e, --env <env>', 'Custom env file to include in the studio')
  .option('-h, --server-host <serverHost>', 'Host of the Mastra API server (default: localhost)')
  .option('-s, --server-port <serverPort>', 'Port of the Mastra API server (default: 4111)')
  .option('-x, --server-protocol <serverProtocol>', 'Protocol of the Mastra API server (default: http)')
  .option('--server-api-prefix <serverApiPrefix>', 'API route prefix of the Mastra server (default: /api)')
  .option('--request-context-presets <file>', 'Path to request context presets JSON file')
  .action(startStudio);

const deployCommand = studioCommand
  .command('deploy [dir]')
  .description('Deploy studio')
  .option('--org <id>', 'Organization ID')
  .option('--project <id>', 'Project ID')
  .option('-y, --yes', 'Auto-accept defaults without confirmation')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .option('--env-file <file>', 'Env file to deploy (for example: .env.production)')
  .option('--skip-build', 'Skip the build step and use existing .mastra/output')
  .option('--debug', 'Enable debug logs', false)
  .action(wrapAction(deployAction));

deployCommand.command('list').description('List deployed studios').action(wrapAction(deploysAction));

deployCommand
  .command('status <deploy-id>')
  .description('Show deploy status')
  .option('-w, --watch', 'Watch for status changes')
  .action(wrapAction(statusAction));

deployCommand
  .command('logs <deploy-id>')
  .description('Show deploy logs')
  .option('-f, --follow', 'Stream logs in real time')
  .option('--tail <n>', 'Number of recent log lines')
  .action(wrapAction(logsAction));

if (coreFeatures.has('deploy-diagnosis')) {
  deployCommand
    .command('suggestions [deploy-id]')
    .description('Show deploy suggestions for a failed deploy')
    .action(wrapAction(suggestionsAction));
}

const studioProjects = studioCommand
  .command('projects')
  .description('Manage studio projects')
  .action(wrapAction(listProjectsAction));

studioProjects.command('create').description('Create a new project').action(wrapAction(createProjectAction));

program
  .command('migrate')
  .description('Run database migrations to update storage schema')
  .option('-d, --dir <path>', 'Path to your Mastra folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-e, --env <env>', 'Custom env file to include')
  .option('--debug', 'Enable debug logs', false)
  .option('-y, --yes', 'Skip confirmation prompt (for CI/automation)')
  .action(migrate);

const scorersCommand = program.command('scorers').description('Manage scorers for evaluating AI outputs');

scorersCommand
  .command('add [scorer-name]')
  .description('Add a new scorer to your project')
  .option('-d, --dir <path>', 'Path to your Mastra directory (default: auto-detect)')
  .action(addScorer);

scorersCommand.command('list').description('List available scorer templates').action(listScorers);

// ---- Auth commands ----

const authCommand = program.command('auth').description('Manage authentication');

authCommand.command('login').description('Log in to Mastra').action(wrapAction(loginAction));

authCommand.command('logout').description('Log out and clear credentials').action(wrapAction(logoutAction));

authCommand.command('whoami').description('Show current user and organization').action(wrapAction(whoamiAction));

const authOrgs = authCommand.command('orgs').description('Manage organizations').action(wrapAction(listOrgsAction));

authOrgs.command('switch').description('Switch current organization').action(wrapAction(switchOrgAction));

const authTokens = authCommand.command('tokens').description('Manage API tokens').action(wrapAction(listTokensAction));

authTokens.command('create <name>').description('Create a new API token').action(wrapAction(createTokenAction));

authTokens.command('revoke <token-id>').description('Revoke an API token').action(wrapAction(revokeTokenAction));

// ---- Server commands ----

const serverCommand = program.command('server').description('Manage Mastra Server deployments');

const serverDeployCommand = serverCommand
  .command('deploy [dir]')
  .description('Deploy to Mastra Server')
  .option('--org <id>', 'Organization ID')
  .option('--project <id>', 'Project ID')
  .option('-y, --yes', 'Auto-accept defaults without confirmation')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .option('--env-file <file>', 'Env file to deploy (for example: .env.production)')
  .option('--skip-build', 'Skip the build step and deploy the existing .mastra/output directory')
  .option('--debug', 'Enable debug logs', false)
  .action(wrapAction(serverDeployAction));

if (coreFeatures.has('deploy-diagnosis')) {
  serverDeployCommand
    .command('suggestions [deploy-id]')
    .description('Show deploy suggestions for a failed deploy')
    .option('--org <id>', 'Organization ID')
    .action(wrapAction(serverSuggestionsAction));
}

serverCommand
  .command('pause')
  .description('Pause the linked Mastra Server project instance')
  .option('--org <id>', 'Organization ID')
  .option('--project <id>', 'Project ID or slug (overrides linked project when MASTRA_PROJECT_ID is unset)')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(serverPauseAction));

serverCommand
  .command('restart')
  .description('Restart the linked Mastra Server project instance')
  .option('--org <id>', 'Organization ID')
  .option('--project <id>', 'Project ID or slug (overrides linked project when MASTRA_PROJECT_ID is unset)')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(serverRestartAction));

const serverEnvCommand = serverCommand.command('env').description('Manage server environment variables');

serverEnvCommand
  .command('list')
  .description('List environment variables for the linked project')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(envListAction));

serverEnvCommand
  .command('set <key> <value>')
  .description('Set an environment variable')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(envSetAction));

serverEnvCommand
  .command('unset <key>')
  .description('Remove an environment variable')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(envUnsetAction));

serverEnvCommand
  .command('import <file>')
  .description('Import environment variables from a .env file')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .action(wrapAction(envImportAction));

serverEnvCommand
  .command('pull [file]')
  .description('Pull environment variables into a local .env file (default: .env)')
  .option('-c, --config <file>', 'Project config file path (default: .mastra-project.json)')
  .option('--project <id>', 'Project ID or slug (overrides linked project when MASTRA_PROJECT_ID is unset)')
  .action(wrapAction(envPullAction));

program.parse(process.argv);

export { PosthogAnalytics } from './analytics/index';
export { create } from './commands/create/create';
