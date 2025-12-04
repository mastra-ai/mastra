// @ts-nocheck
import { Workflow } from '@mastra/core/workflows';

const workflow = new Workflow({
  name: 'my-workflow',
  // config
});

const run = await workflow.createRun();

const stream = await run.streamVNext({
  inputData: {
    value: "initial data",
  },
});

const newStream = await run.resumeStreamVNext();

const observedStream = await run.observeStreamVNext();