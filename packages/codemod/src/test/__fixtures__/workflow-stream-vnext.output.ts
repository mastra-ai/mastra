// @ts-nocheck
import { Workflow } from '@mastra/core/workflows';

const workflow = new Workflow({
  name: 'my-workflow',
  // config
});

const run = await workflow.createRun();

const stream = await run.stream({
  inputData: {
    value: "initial data",
  },
});

const newStream = await run.resumeStream();

const observedStream = await run.observeStream();