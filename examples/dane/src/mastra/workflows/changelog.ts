import { delay } from '@mastra/core';
import { Step, Workflow } from '@mastra/core/workflows';
import chalk from 'chalk';
import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';

import { slack } from '../tools/mcp.js';

export const changelogWorkflow = new Workflow({
  name: 'changelog',
  triggerSchema: z.object({
    channelId: z.string(),
  }),
});

const stepA1 = new Step({
  id: 'stepA1',
  description: 'Get a git diff',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ mastra }) => {
    // For today
    try {
      await slack.connect();
    } catch (e) {
      console.error(e);
    }

    const today = new Date().toISOString().split('T')[0];

    if (existsSync(`generated-changelogs/changelog-${today}`)) {
      console.log(chalk.red(`Changelog for today already exists`));
      return {
        message: readFileSync(`generated-changelogs/changelog-${today}`, 'utf-8'),
      };
    }

    console.log(today);

    // For 7 days ago
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(weekAgo);

    const cwd = process.cwd();

    console.log(cwd);

    const modulePaths = [
      'packages/core',
      'packages/cli',
      'packages/create-mastra',
      'packages/deployer',
      'packages/evals',
      'packages/rag',
      'packages/memory',
      'packages/mcp',

      // Deployers
      'deployers/cloudflare',
      'deployers/netlify',
      'deployers/vercel',

      // Speech modules
      'speech/azure',
      'speech/deepgram',
      'speech/elevenlabs',
      'speech/google',
      'speech/ibm',
      'speech/murf',
      'speech/openai',
      'speech/playai',
      'speech/replicate',
      'speech/speechify',

      // Storage modules
      'stores/pg',
      'stores/astra',
      'stores/chroma',
      'stores/pinecone',
      'stores/qdrant',
      'stores/upstash',
      'stores/vectorize',
    ];

    const moduleChangelogs = [];

    let generatedText = '';

    let TOKEN_LIMIT = 80000;

    for (const modulePath of modulePaths) {
      const args = [
        '--no-pager',
        'diff',
        '--unified=1', // Reduced context to 1 line
        '--no-prefix',
        '--color=never',
        `main@{${weekAgo}}`,
        `main@{${today}}`,
        '--',
        modulePath,
        ':!**/node_modules/**',
        ':!**/.turbo/**',
        ':!**/.next/**',
        ':!**/coverage/**',
        ':!**/package-lock.json',
        ':!**/pnpm-lock.yaml',
        ':!**/yarn.lock',
        ':!**/*.bin',
        ':!**/*.exe',
        ':!**/*.dll',
        ':!**/*.so',
        ':!**/*.dylib',
        ':!**/*.class',
        ':!**/dist/**',
      ];
      console.log(`git ${args.join(' ')}`);

      try {
        const diff = await execa('git', args, {
          cwd,
        });

        const output = diff.stdout.trim();

        if (output) {
          // Only generate changelog if there are changes
          console.log(`${modulePath} changes length: ${output.length}`);

          const modulePrompt = `
            Time: ${weekAgo} - ${today}
            Module: ${modulePath}

            Git diff to generate from: ${output}

            # Task
            1. Create a structured narrative changelog that highlights key updates and improvements for this module.
            2. Focus only on meaningful changes, ignore trivial ones.
            3. Group changes into categories:
            - New features
            - Improvements
            - Notable bug fixes
            - Build/deployment improvements
            - Performance optimizations
          `;

          const agent = mastra?.getAgent('daneChangeLog');

          if (!agent) {
            throw new Error('LLM not found');
          }

          const result = await agent.generate(modulePrompt);

          moduleChangelogs.push({
            module: modulePath,
            changelog: result.text,
          });

          generatedText += `\n ## ${modulePath}\n${result.text}`;
          writeFileSync(`generated-changelogs/changelog-${today}`, generatedText);

          if (result.usage.promptTokens) {
            console.log(`Total prompt tokens used: ${result.usage.promptTokens}`);
          }

          TOKEN_LIMIT -= result.usage.promptTokens;

          if (TOKEN_LIMIT < 20000) {
            await delay(60000);
            TOKEN_LIMIT = 80000;
          }
        }
      } catch (e) {
        console.error(`Error processing ${modulePath}:`, e);
      }
    }

    // Combine all changelogs
    const combinedChangelog = moduleChangelogs
      .map(({ module, changelog }) => `## ${module}\n${changelog}`)
      .join('\n\n');

    writeFileSync(`generated-changelogs/changelog-${today}`, combinedChangelog);

    return {
      message: combinedChangelog,
    };
  },
});

const stepA2 = new Step({
  id: 'stepA2',
  description: 'Make changelog',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (context?.steps.stepA1?.status !== 'success') {
      throw new Error('Message not found');
    }

    const agent = mastra?.getAgent('daneChangeLog');

    if (!agent) {
      throw new Error('LLM not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const tools = await slack.tools();

    const channelId = context.triggerData.channelId;

    const prompt = `
            Time: ${weekAgo} - ${today}

            ${context.steps.stepA1.output.message}
            # Task
            1. create a structured narrative changelog that highlights key updates and improvements.
            2. Include what packages were changed

            ## Structure

            1. Opening
            - Brief welcome/context (1-2 sentences)
            - Time period covered

            2. Major Updates (3-4 key highlights)
            - Lead with the most impactful changes
            - Include brief technical context where needed
            - Reference relevant PR numbers
            - Link to examples/docs where applicable

            3. Technical Improvements
            - Group related changes
            - Focus on developer impact
            - Include code snippets if helpful

            4. Documentation & Examples
            - New guides/tutorials
            - Updated examples
            - API documentation changes

            5. Bug Fixes & Infrastructure
            - Notable bug fixes
            - Build/deployment improvements
            - Performance optimizations

            Finally send this to this slack channel: "${channelId}" with the tool slack_post_message
        `;

    console.log(chalk.green(`Generating...`));

    try {
      const result = await agent.generate(prompt, {
        toolsets: {
          slack: tools,
        },
      });

      console.log(chalk.green(result.text));

      return {
        message: result.text,
      };
    } catch (e) {
      console.log(chalk.red(e));
      return {
        message: e as string,
      };
    }
  },
});

// Update workflow to use both steps
changelogWorkflow.step(stepA1).then(stepA2).commit();
