import { Step, Workflow } from '@mastra/core';
import { execSync } from 'child_process';
import { z } from 'zod';

export const commitMessageGenerator = new Workflow({
  name: 'commit-message',
  triggerSchema: z.object({
    resourceid: z.string(),
    threadId: z.string(),
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
    const diff = execSync('git diff', {
      cwd: repoPath,
      encoding: 'utf-8',
    });

    return { diff };
  },
});

const generateMessage = new Step({
  id: 'generateMessage',
  outputSchema: z.object({
    commitMessage: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const parentStep = context?.machineContext?.stepResults?.getDiff;
    if (!parentStep || parentStep.status !== 'success') {
      return { commitMessage: '' };
    }

    const daneCommitGenerator = mastra?.agents?.daneCommitGenerator;

    const res = await daneCommitGenerator?.generate(
      `
        Given this git diff:
        ${parentStep.payload.diff}

        Please generate a concise and descriptive commit message that follows these guidelines:
        - Start with a verb in the present tense
        - Be specific but concise
        - Focus on the "what" and "why" of the changes
        - Keep the first line under 50 characters
        - If needed, add more detailed description after a blank line
      `,
      {
        schema: z.object({
          commitMessage: z.string(),
        }),
      },
    );

    return { commitMessage: res?.object?.commitMessage as string };
  },
});

const displayMessage = new Step({
  id: 'displayMessage',
  execute: async ({ context }) => {
    const parentStep = context?.machineContext?.stepResults?.generateMessage;
    if (!parentStep || parentStep.status !== 'success') {
      return;
    }

    console.log('Generated commit message:');
    console.log(parentStep.payload.commitMessage);
  },
});

commitMessageGenerator.step(getDiff).then(generateMessage).then(displayMessage).commit();
