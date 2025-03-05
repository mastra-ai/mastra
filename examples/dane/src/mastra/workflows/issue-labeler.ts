import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

import { github } from '../integrations/index.js';

export const githubIssueLabeler = new Workflow({
  name: 'github-issue-labeler',
  triggerSchema: z.object({
    repo: z.string(),
    owner: z.string(),
    issue_number: z.number(),
  }),
});

const getIssue = new Step({
  id: 'getIssue',
  outputSchema: z.object({
    title: z.string(),
    body: z.string(),
    labelNames: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    const client = await github.getApiClient();

    const issue = await client.issuesGet({
      path: {
        // TODO: Type triggerData in context to the triggerSchema
        owner: context?.triggerData?.owner,
        repo: context?.triggerData?.repo,
        issue_number: context?.triggerData?.issue_number,
      },
    });

    const labels = await client.issuesListLabelsForRepo({
      path: {
        owner: context?.triggerData?.owner,
        repo: context?.triggerData?.repo,
      },
    });

    const labelNames = labels?.data?.map((label: any) => label.name);

    return { title: issue?.data?.title!, body: issue?.data?.body!, labelNames: labelNames! };
  },
});

const labelIssue = new Step({
  id: 'labelIssue',
  outputSchema: z.object({
    labels: z.array(z.string()),
  }),
  execute: async ({ context, mastra }) => {
    const parentStep = context?.steps?.getIssue;
    if (!parentStep || parentStep.status !== 'success') {
      return { labels: [] };
    }

    const daneIssueLabeler = mastra?.getAgent('daneIssueLabeler');

    const res = await daneIssueLabeler?.generate(
      `
            Hey Dane, given:
            * this issue title: ${parentStep?.output?.title}
            * this issue body: ${parentStep?.output?.body}
            * these labels: ${parentStep?.output?.labelNames}

            What label or labels would you assign?
        `,
      {
        output: z.object({
          labels: z.array(z.string()),
        }),
      },
    );

    return { labels: res?.object?.labels as string[] };
  },
});

const applyLabels = new Step({
  id: 'applyLabels',
  execute: async ({ context }) => {
    const parentStep = context?.steps?.labelIssue;

    if (!parentStep || parentStep.status !== 'success') {
      return;
    }

    const client = await github.getApiClient();

    await client.issuesAddLabels({
      path: {
        owner: context?.triggerData?.owner,
        repo: context?.triggerData?.repo,
        issue_number: context?.triggerData?.issue_number,
      },
      body: {
        labels: parentStep.output.labels,
      },
    });
  },
});

githubIssueLabeler.step(getIssue).then(labelIssue).then(applyLabels).commit();
