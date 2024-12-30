import { confirm } from '@inquirer/prompts';
import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { execSync } from 'child_process';
import { z } from 'zod';

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
    const repoPath = context?.machineContext?.triggerData?.repoPath;

    // Get the git diff of staged changes
    const diff = execSync('git diff --staged', {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    return { diff };
  },
});

const getConventionalCommitSpec = new Step({
  id: 'getConventionalCommitSpec',
  outputSchema: z.object({
    conventionalCommitSpec: z.any(),
  }),
  execute: async ({ mastra }) => {
    const crawlData = await mastra?.syncs?.['FIRECRAWL:CRAWL_AND_SYNC']?.execute({
      context: {
        url: 'https://www.conventionalcommits.org/en/v1.0.0/',
        limit: 3,
        pathRegex: null,
      },
      engine: mastra?.engine,
    });

    console.log({ crawlData });

    return { conventionalCommitSpec: crawlData };
  },
});

const generateMessage = new Step({
  id: 'generateMessage',
  outputSchema: z.object({
    commitMessage: z.string(),
    generated: z.boolean(),
  }),
  execute: async ({ context, mastra }) => {
    const diffStep = context?.machineContext?.stepResults?.getDiff;
    const conventionalCommitSpecStep = context?.machineContext?.stepResults?.getConventionalCommitSpec;
    if (!diffStep || diffStep.status !== 'success') {
      return { commitMessage: '', generated: false };
    }

    const daneCommitGenerator = mastra?.agents?.daneCommitMessage;

    const res = await daneCommitGenerator?.generate(
      `
        Given this git diff:
        ${diffStep.payload.diff}

        IF THE DIFF IS EMPTY, RETURN "No staged changes found", AND SET GENERATED TO FALSE,
        OTHERWISE, SET GENERATED TO TRUE

        ${
          conventionalCommitSpecStep && conventionalCommitSpecStep.status === 'success'
            ? `Please generate a concise and descriptive commit message that follows the conventional commit guidelines:
        ${conventionalCommitSpecStep.payload.conventionalCommitSpec}`
            : `Please generate a concise and descriptive commit message that follows these guidelines:
        - Start with a verb in the present tense
        - Be specific but concise
        - Focus on the "what" and "why" of the changes
        - Keep the first line under 50 characters
        - If needed, add more detailed description after a blank line`
        }
      `,
      {
        schema: z.object({
          commitMessage: z.string(),
          generated: z.boolean(),
        }),
      },
    );

    if (!res?.object?.generated) {
      throw new Error(res?.object?.commitMessage as string);
    }

    return { commitMessage: res?.object?.commitMessage as string, generated: res?.object?.generated as boolean };
  },
});

const confirmationStep = new Step({
  id: 'confirmation',
  outputSchema: z.object({
    confirm: z.boolean(),
  }),
  execute: async ({ context }) => {
    const parentStep = context?.machineContext?.stepResults?.generateMessage;
    if (!parentStep || parentStep.status !== 'success') {
      return { confirm: false };
    }

    if (!parentStep.payload.generated) {
      return { confirm: false };
    }

    const commitMessage = parentStep.payload.commitMessage;

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
    const parentStep = context?.machineContext?.stepResults?.confirmation;
    if (!parentStep || parentStep.status !== 'success' || !parentStep.payload.confirm) {
      throw new Error('Commit message generation cancelled');
    }

    if (context?.machineContext?.stepResults?.generateMessage?.status !== 'success') {
      throw new Error('Failed to generate commit message');
    }

    const commitMessage = context?.machineContext?.stepResults?.generateMessage?.payload?.commitMessage;
    execSync(`git commit -m "${commitMessage}"`, {
      cwd: context?.machineContext?.triggerData?.repoPath,
      encoding: 'utf-8',
    });

    return { commit: true };
  },
});

commitMessageGenerator
  .step(getDiff)
  .then(getConventionalCommitSpec)
  .then(generateMessage)
  .then(confirmationStep)
  .then(commitStep)
  .commit();
