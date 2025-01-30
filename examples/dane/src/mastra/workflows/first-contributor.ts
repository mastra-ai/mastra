import { Step, Workflow } from '@mastra/core';
import { z } from 'zod';

import { github } from '../integrations/index.js';

export const githubFirstContributorMessage = new Workflow({
  name: 'github-first-contributor-message',
  triggerSchema: z.object({
    repo: z.string(),
    owner: z.string(),
    pr_number: z.number(),
  }),
});

const getPullRequest = new Step({
  id: 'getPullRequest',
  outputSchema: z.object({
    title: z.string(),
    body: z.string(),
    diff: z.string(),
  }),
  execute: async ({ context }) => {
    const client = await github.getApiClient();

    const pullRequest = await client.pullsGet({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
        pull_number: context?.machineContext?.triggerData?.pr_number,
      },
    });

    if (!pullRequest?.data) {
      throw new Error('Pull request not found');
    }

    const response = await fetch(pullRequest.data.diff_url);
    const diff = await response.text();

    return {
      title: pullRequest.data.title,
      body: pullRequest.data.body || '',
      diff,
    };
  },
});

const generateMessage = new Step({
  id: 'message-generator',
  outputSchema: z.object({
    message: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const parentStep = context?.machineContext?.stepResults?.getPullRequest;
    if (!parentStep || parentStep.status !== 'success') {
      return { message: [] };
    }

    const mastraDocsRes = await fetch('https://mastra.ai/llms.txt');
    const mastraDocs = await mastraDocsRes.text();

    const daneNewContributor = mastra?.agents?.daneNewContributor;

    const res = await daneNewContributor?.generate(
      `
Hey Dane, given:
START TITLE
${parentStep?.payload?.title}
END TITLE

START BODY
${parentStep?.payload?.body}
END BODY
START DIFF
${parentStep?.payload?.diff}
END DIFF

I'll give you some more context about Mastra:
MASTRA DOCS
${mastraDocs}
END MASTRA DOCS

Write message to the contributor to thank them for their first contribution? And check if the following guidelines are followed, do not mention these checklist if they are actually checked:
- Check if the body matches the diff and is not empty
- Check if tests are added or updated
- check if the code looks similar to what's already written
- Ask if they have tested the changes on any of the examples

VERY IMPORTANT:
You should not summarize nor you should give advice on the code itself, only follow the guidelines.

The message should bes strucutred like:
an intro message to thank the user for their contribution
the checklist
and an outro that just says thank you again and that we will review it shortly. If there is no checklist we should skip thank you.
        `,
      {
        output: z.object({
          intro: z.string(),
          checklist: z.string().array(),
          outro: z.string(),
        }),
      },
    );

    if (!res) {
      throw new Error(`We couldn't generate a message`);
    }

    return res.object;
  },
});

const createMessage = new Step({
  id: 'create-message',
  execute: async ({ context }) => {
    const parentStep = context?.machineContext?.stepResults?.['message-generator'];

    if (!parentStep || parentStep.status !== 'success') {
      return;
    }

    const client = await github.getApiClient();
    const res = await client.issuesCreateComment({
      path: {
        owner: context?.machineContext?.triggerData?.owner,
        repo: context?.machineContext?.triggerData?.repo,
        issue_number: context?.machineContext?.triggerData?.pr_number,
      },
      body: {
        body: `${parentStep.payload.intro}

${parentStep.payload.checklist.map((s: string) => `- [ ] ${s}`).join('\n')}

${parentStep.payload.outro}`,
      },
    });

    console.log(res);
  },
});

githubFirstContributorMessage.step(getPullRequest).then(generateMessage).then(createMessage).commit();
