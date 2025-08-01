#! /usr/bin/env node
import { Command } from 'commander';

import { config } from 'dotenv';
import { PosthogAnalytics, setAnalytics } from './analytics/index';
import type { CLI_ORIGIN } from './analytics/index';
import { build } from './commands/build/build';
import { create } from './commands/create/create';
import { deploy } from './commands/deploy/index';
import { dev } from './commands/dev/dev';
import { init } from './commands/init/init';
import { checkAndInstallCoreDeps, checkPkgJson, interactivePrompt } from './commands/init/utils';
import { lint } from './commands/lint';
import { start } from './commands/start';
import { DepsService } from './services/service.deps';
import { logger } from './utils/logger';

const depsService = new DepsService();
const version = await depsService.getPackageVersion();

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: version!,
});

setAnalytics(analytics);

const program = new Command();

const origin = process.env.MASTRA_ANALYTICS_ORIGIN as CLI_ORIGIN;

program
  .version(`${version}`, '-v, --version')
  .description(`Mastra CLI ${version}`)
  .action(() => {
    try {
      analytics.trackCommand({
        command: 'version',
        origin,
      });
      console.log(`Mastra CLI: ${version}`);
    } catch {
      // ignore
    }
  });

program
  .command('create [project-name]')
  .description('Create a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, examples)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, groq, google, or cerebras))')
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
  .action(async (projectNameArg, args) => {
    // Unify: use argument if present, else option
    const projectName = projectNameArg || args.projectName;
    await analytics.trackCommandExecution({
      command: 'create',
      args: { ...args, projectName },
      execution: async () => {
        const timeout = args?.timeout ? (args?.timeout === true ? 60000 : parseInt(args?.timeout, 10)) : undefined;
        if (args.default) {
          await create({
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: true,
            timeout,
            mcpServer: args.mcp,
            template: args.template,
          });
          return;
        }
        await create({
          components: args.components ? args.components.split(',') : [],
          llmProvider: args.llm,
          addExample: args.example,
          llmApiKey: args['llm-api-key'],
          timeout,
          projectName,
          directory: args.dir,
          mcpServer: args.mcp,
          template: args.template,
        });
      },
      origin,
    });
  });

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
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'init',
      args,
      execution: async () => {
        await checkPkgJson();
        await checkAndInstallCoreDeps(args?.example || args?.default);

        if (!Object.keys(args).length) {
          const result = await interactivePrompt();
          await init({
            ...result,
            llmApiKey: result?.llmApiKey as string,
            components: ['agents', 'tools', 'workflows'],
            addExample: true,
          });
          return;
        }

        if (args?.default) {
          await init({
            directory: 'src/',
            components: ['agents', 'tools', 'workflows'],
            llmProvider: 'openai',
            addExample: true,
            configureEditorWithDocsMCP: args.mcp,
          });
          return;
        }

        const componentsArr = args.components ? args.components.split(',') : [];
        await init({
          directory: args.dir,
          components: componentsArr,
          llmProvider: args.llm,
          addExample: args.example,
          llmApiKey: args['llm-api-key'],
          configureEditorWithDocsMCP: args.mcp,
        });
        return;
      },
      origin,
    });
  });

program
  .command('lint')
  .description('Lint your Mastra project')
  .option('-d, --dir <path>', 'Path to your Mastra folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'lint',
      args,
      execution: async () => {
        await lint({ dir: args.dir, root: args.root, tools: args.tools ? args.tools.split(',') : [] });
      },
      origin,
    });
  });

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
  .option('-s, --https', 'Enable HTTPS for the local development server')
  .option(
    '-c, --custom-args <args>',
    'Comma-separated list of custom arguments to pass to the dev server. IE: --experimental-transform-types',
  )
  .action(args => {
    analytics.trackCommand({
      command: 'dev',
      origin,
    });

    if (args?.port) {
      logger.warn('The --port option is deprecated. Use the server key in the Mastra instance instead.');
    }

    dev({
      port: args?.port ? parseInt(args.port) : null,
      dir: args?.dir,
      root: args?.root,
      tools: args?.tools ? args.tools.split(',') : [],
      env: args?.env,
      inspect: args?.inspect && !args?.inspectBrk,
      inspectBrk: args?.inspectBrk,
      https: args?.https,
      customArgs: args?.customArgs ? args.customArgs.split(',') : [],
    }).catch(err => {
      logger.error(err.message);
    });
  });

program
  .command('build')
  .description('Build your Mastra project')
  .option('-d, --dir <path>', 'Path to your Mastra Folder')
  .option('-r, --root <path>', 'Path to your root folder')
  .option('-t, --tools <toolsDirs>', 'Comma-separated list of paths to tool files to include')
  .option('-e, --env <env>', 'Custom env file to include in the build')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'mastra build',
      args,
      execution: async () => {
        await build({
          dir: args?.dir,
          root: args?.root,
          tools: args?.tools ? args.tools.split(',') : [],
          env: args?.env,
        });
      },
      origin,
    });
  });

program
  .command('deploy')
  .description('Deploy your Mastra project')
  .option('-d, --dir <path>', 'Path to directory')
  .action(async args => {
    config({ path: ['.env', '.env.production'] });
    await analytics.trackCommandExecution({
      command: 'mastra deploy',
      args,
      execution: async () => {
        logger.warn(`DEPRECATED: The deploy command is deprecated.
          Please use the mastra build command instead.
          Then deploy .mastra/output to your target platform.
          `);
        await deploy({ dir: args.dir });
      },
      origin,
    });
  });

program
  .command('start')
  .description('Start your built Mastra application')
  .option('-d, --dir <path>', 'Path to your built Mastra output directory (default: .mastra/output)')
  .option('-nt, --no-telemetry', 'Disable telemetry on start')
  .action(async args => {
    await analytics.trackCommandExecution({
      command: 'start',
      args,
      execution: async () => {
        await start({
          dir: args.dir,
          telemetry: !args.noTelemetry,
        });
      },
      origin,
    });
  });

program.parse(process.argv);

export { create } from './commands/create/create';
export { PosthogAnalytics } from './analytics/index';
