import { confirm } from '@inquirer/prompts';
import { Step, Workflow } from '@mastra/core/workflows';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { z } from 'zod';

import { fsTool } from '../tools/fs.js';

export const commitMessageGenerator = new Workflow({
  name: 'commit-message',
  triggerSchema: z.object({
    repoPath: z.string(),
  }),
});

const getDiff = new Step({
  id: 'getDiff',
  outputSchema: z.object({
    diff: z.string(),
  }),
  execute: async ({ context }) => {
    const repoPath = context?.getStepResult<{ repoPath: string }>('trigger')?.repoPath;

    // Get the git diff of staged changes
    const diff = execSync('git diff --staged', {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    return { diff };
  },
});

const readConventionalCommitSpec = new Step({
  id: 'readConventionalCommitSpec',
  outputSchema: z.object({
    fileData: z.any(),
  }),
  execute: async ({ suspend }) => {
    if (!fsTool?.execute) {
      return { fileData: null };
    }

    const fileData = await fsTool.execute({
      context: { action: 'read', file: 'data/crawl/conventional-commit.json', data: '' } as any,
      suspend,
    });

    return { fileData };
  },
});

const generateMessage = new Step({
  id: 'generateMessage',
  outputSchema: z.object({
    commitMessage: z.string(),
    generated: z.boolean(),
    guidelines: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const diffData = context?.getStepResult<{ diff: string }>('getDiff');
    const fileData = context?.getStepResult<{ fileData: any }>('readConventionalCommitSpec');

    if (!diffData) {
      return { commitMessage: '', generated: false, guidelines: [] };
    }

    const daneCommitGenerator = mastra?.getAgent('daneCommitMessage');

    const res = await daneCommitGenerator?.generate(
      `
        Given this git diff:
        ${diffData.diff}

        IF THE DIFF IS EMPTY, RETURN "No staged changes found", AND SET GENERATED TO FALSE,
        OTHERWISE, SET GENERATED TO TRUE

        ${
          fileData && fileData.fileData?.message
            ? `USE THE FOLLOWING GUIDELINES: ${fileData.fileData?.message}`
            : `USE THE FOLLOWING GUIDELINES:
        - Start with a verb in the present tense
        - Be specific but concise
        - Focus on the "what" and "why" of the changes
        IF THERE ARE MULTIPLE LOGICAL CHANGES, USE THE DESCRIPTION TO EXPLAIN THE CHANGES IN BULLET POINTS.

        - Keep the first line under 50 characters
        - If needed, add more detailed description after a blank line`
        }

        RETURN THE GUIDELINES YOU ARE USING AS AN ARRAY OF STRINGS ON THE GUIDELINES KEY, AND THE COMMIT MESSAGE ON THE COMMIT MESSAGE KEY
      `,
      {
        output: z.object({
          commitMessage: z.string(),
          generated: z.boolean(),
          guidelines: z.array(z.string()),
        }),
      },
    );

    if (!res?.object?.generated) {
      throw new Error(res?.object?.commitMessage as string);
    }

    return {
      commitMessage: res?.object?.commitMessage as string,
      generated: res?.object?.generated as boolean,
      guidelines: res?.object?.guidelines as string[],
    };
  },
});

const confirmationStep = new Step({
  id: 'confirmation',
  outputSchema: z.object({
    confirm: z.boolean(),
  }),
  execute: async ({ context }) => {
    const parentStep = context?.steps?.generateMessage;
    if (!parentStep || parentStep.status !== 'success') {
      return { confirm: false };
    }

    if (!parentStep.output.generated) {
      return { confirm: false };
    }

    const commitMessage = parentStep.output.commitMessage;

    const confirmationMessage = await confirm({
      message: `\n Would you like to use this commit message? \n\n ${chalk.yellow(commitMessage)}\n\n`,
    });

    return { confirm: confirmationMessage };
  },
});

const commitStep = new Step({
  id: 'commit',
  outputSchema: z.object({
    commit: z.boolean(),
  }),
  execute: async ({ context }) => {
    const parentStep = context?.steps?.confirmation;
    if (!parentStep || parentStep.status !== 'success' || !parentStep.output.confirm) {
      throw new Error('Commit message generation cancelled');
    }

    if (context?.steps?.generateMessage?.status !== 'success') {
      throw new Error('Failed to generate commit message');
    }

    const commitMessage = context?.steps?.generateMessage?.output?.commitMessage;
    execSync(`git commit -m "${commitMessage}"`, {
      cwd: context?.triggerData?.repoPath,
      encoding: 'utf-8',
    });

    return { commit: true };
  },
});

commitMessageGenerator
  .step(getDiff)
  .then(readConventionalCommitSpec)
  .then(generateMessage)
  .then(confirmationStep)
  .then(commitStep)
  .commit();
