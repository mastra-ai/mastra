import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import { z } from 'zod';

import { dane } from '../agents';

export const browserBreakdown = new Workflow({
  name: 'browser-breakdown',
  triggerSchema: z.object({
    url: z.string(),
  }),
});

const processContent = new Step({
  id: 'process-content-for-output',
  // Need to default input schema
  inputSchema: z.object({}),
  outputSchema: z.object({
    message: z.string(),
  }),
  // SHOULD BE ABLE TO ACCESS ALL MASTRA PRIMS FROM EXECTUE
  execute: async props => {
    console.log(props);
    const url = props.context.machineContext?.triggerData?.url;

    console.log(url);

    const res = await dane.generate(`Here is the url: ${url} we need to relay.`, {
      stream: true,
      maxSteps: 5,
    });

    console.log(chalk.green(`\nDane: \n`));

    for await (const chunk of res.textStream) {
      process.stdout.write(chalk.green(chunk));
    }

    console.log(chalk.green(`\n`));

    return { message: 'success' };
  },
});

browserBreakdown.step(processContent).commit();
