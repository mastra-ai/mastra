import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { execa } from 'execa';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { z } from 'zod';

import { slack } from '../tools/mcp';

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
  execute: async () => {
    console.log('SUH');
    // For today
    try {
      await slack.connect();
    } catch (e) {
      console.error(e);
    }

    const today = new Date().toISOString().split('T')[0];

    console.log(today);

    // For 7 days ago
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    console.log(weekAgo);

    const cwd = process.cwd();

    console.log(cwd);

    const args = [
      '--no-pager',
      'diff',
      '--unified=1', // Reduced context to 1 line
      '--no-prefix',
      '--color=never',
      '--shortstat', // Get size first to check
      `main@{${weekAgo}}`,
      `main@{${today}}`,
      '--',
      'packages/**',
      // 'docs/**'
    ];
    console.log(args);
    const p = execa('git', args, {
      cwd,
    });

    try {
      const diff = await p;
      return {
        message: diff.stdout,
      };
    } catch (e) {
      console.error(e);
      return {
        message: 'Error, do not compute',
      };
    }
  },
});

const stepA2 = new Step({
  id: 'stepA2',
  description: 'Make changelog',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    if (context.machineContext?.stepResults.stepA1?.status !== 'success') {
      throw new Error('Message not found');
    }

    const agent = mastra?.agents?.daneChangeLog;

    if (!agent) {
      throw new Error('LLM not found');
    }

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const tools = await slack.tools();

    if (existsSync(`changelog-${today}`)) {
      const existing = readFileSync(`changelog-${today}`, 'utf-8');

      await agent.generate(
        `
                Send this ${existing} to this slack channel: "${context.machineContext.triggerData.channelId}" with the tool slack_post_message.
                Format it in markdown so it displays nicely in slack.
                `,
        {
          toolsets: {
            slack: tools,
          },
        },
      );

      return {
        message: existing,
      };
    }

    const channelId = context.machineContext.triggerData.channelId;

    const prompt = `
            Time: ${weekAgo} - ${today}

            Git diff to generate from: ${context.machineContext.stepResults.stepA1.payload.message}
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
    const result = await agent.generate(prompt, {
      toolsets: {
        slack: tools,
      },
    });

    console.log(chalk.green(result.text));

    writeFileSync(`changelog-${today}`, result.text);

    return {
      message: result.text,
    };
  },
});

changelogWorkflow.step(stepA1).then(stepA2).commit();
