#! /usr/bin/env node
import { Command } from 'commander';

import { create } from 'mastra/dist/commands/create/create.js';

const program = new Command();

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
