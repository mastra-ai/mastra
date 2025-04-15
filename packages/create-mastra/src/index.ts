#! /usr/bin/env node
import { Command } from 'commander';

import { PosthogAnalytics } from 'mastra/dist/analytics/index.js';
import { create } from 'mastra/dist/commands/create/create.js';

import { getPackageVersion, getCreateVersionTag } from './utils.js';

const version = await getPackageVersion();
const createVersionTag = await getCreateVersionTag();

const analytics = new PosthogAnalytics({
  apiKey: 'phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT',
  host: 'https://us.posthog.com',
  version: version!,
});

const program = new Command();

program
  .version(`${version}`, '-v, --version')
  .description(`create-mastra ${version}`)
  .action(async () => {
    try {
      analytics.trackCommand({
        command: 'version',
      });
      console.log(`create-mastra ${version}`);
    } catch {
      // ignore
    }
  });

program
  .name('create-mastra')
  .description('Create a new Mastra project')
  .argument('[project-name]', 'Directory name of the project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, groq, google, or cerebras)')
  .option('-k, --llm-api-key <api-key>', 'API key for the model provider')
  .option('-e, --example', 'Include example code')
  .option('-t, --timeout [timeout]', 'Configurable timeout for package installation, defaults to 60000 ms')
  .action(async (projectName, args) => {
    const timeout = args?.timeout ? (args?.timeout === true ? 60000 : parseInt(args?.timeout, 10)) : undefined;
    if (args.default) {
      await create({
        components: ['agents', 'tools', 'workflows'],
        llmProvider: 'openai',
        addExample: false,
        createVersionTag,
        timeout,
      });
      return;
    }

    await create({
      components: args.components ? args.components.split(',') : [],
      llmProvider: args.llm,
      addExample: args.example,
      llmApiKey: args['llm-api-key'],
      createVersionTag,
      timeout,
      projectName: projectName,
    });
  });

program.parse(process.argv);
