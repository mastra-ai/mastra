#! /usr/bin/env node
import { Command } from 'commander';

import { PosthogAnalytics } from 'mastra/dist/analytics/index.js';
import { create } from 'mastra/dist/commands/create/create.js';

import { getPackageVersion } from './utils.js';

const version = await getPackageVersion();

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
    } catch (e) {}
  });

program
  .name('create-mastra')
  .description('Create a new Mastra project')
  .option('--default', 'Quick start with defaults(src, OpenAI, no examples)')
  .option('-c, --components <components>', 'Comma-separated list of components (agents, tools, workflows)')
  .option('-l, --llm <model-provider>', 'Default model provider (openai, anthropic, or groq)')
  .option('-e, --example', 'Include example code')
  .action(async args => {
    if (args.default) {
      await create({
        components: ['agents', 'tools', 'workflows'],
        llmProvider: 'openai',
        addExample: false,
      });
      return;
    }

    await create({
      components: args.components,
      llmProvider: args.llm,
      addExample: args.example,
    });
  });

program.parse(process.argv);
