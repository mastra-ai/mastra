import { Step, Workflow } from '@mastra/core/workflows';
import chalk from 'chalk';
import child_process from 'node:child_process';
import util from 'node:util';
import { z } from 'zod';

import { slack } from '../tools/mcp.js';

const exec = util.promisify(child_process.exec);

export const linkCheckerWorkflow = new Workflow({
  name: 'link-checker',
  triggerSchema: z.object({
    channelId: z.string(),
    targetUrl: z.string(),
  }),
});

const linkSchema = z.object({
  url: z.string(),
  status: z.number(),
  state: z.enum(['OK', 'BROKEN']),
  parent: z.string().optional(),
});

const getBrokenLinks = new Step({
  id: 'get-broken-links',
  description: 'Get broken links',
  inputSchema: z.object({
    targetUrl: z.string(),
  }),
  outputSchema: z.object({
    brokenLinks: z.array(linkSchema),
  }),
  execute: async ({ context }) => {
    const targetUrl = context.targetUrl;

    const res = await exec(`npx linkinator ${targetUrl} --format json`, {
      encoding: 'utf-8',
    });

    if (res.stderr) {
      throw new Error(res.stderr);
    }

    const data = JSON.parse(res.stdout);

    const parsedData = linkSchema.array().parse(data.links);

    return {
      brokenLinks: parsedData.filter(link => link.state === 'BROKEN'),
    };
  },
});

const reportBrokenLinks = new Step({
  id: 'report-broken-links',
  description: 'Report broken links',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const brokenLinks = context?.getStepResult<{ brokenLinks: z.infer<typeof linkSchema>[] }>('get-broken-links');

    if (!brokenLinks) {
      return {
        message: 'No broken links found',
      };
    }

    if (brokenLinks.brokenLinks.length === 0) {
      return {
        message: 'No broken links found',
      };
    }

    try {
      await slack.connect();
    } catch (e) {
      console.error(e);
    }

    const triggerPayload = context?.getStepResult<{ channelId: string; targetUrl: string }>('trigger');

    if (!triggerPayload) {
      return {
        message: 'Trigger payload not found',
      };
    }

    const agent = mastra?.agents?.daneLinkChecker;

    if (!agent) {
      return {
        message: 'Agent not found',
      };
    }
    const tools = await slack.tools();

    console.log(`🤖Generating...`);
    const res = await agent.generate(
      `
      Send this ${JSON.stringify(brokenLinks, null, 2)} to this slack channel: "${triggerPayload.channelId}" with the tool slack_post_message.
      Format it in markdown so it displays nicely in slack.
      `,
      {
        toolsets: { slack: tools },
      },
    );

    console.log(chalk.green(res.text));

    return {
      message: res.text,
    };
  },
});

linkCheckerWorkflow
  .step(getBrokenLinks, {
    variables: {
      targetUrl: { step: 'trigger', path: 'targetUrl' },
    },
  })
  .then(reportBrokenLinks)
  .commit();
