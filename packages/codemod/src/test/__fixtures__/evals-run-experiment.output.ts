// @ts-nocheck
import { createScorer, runEvals } from '@mastra/core/evals';
import { myAgent } from './agents/my-agent';

const scorer = createScorer({
  id: 'helpfulness-scorer',
  // ...
});

const result = await runEvals({ target: myAgent, scorers: [scorer], data: inputs });

// Multiple calls
const result2 = await runEvals({ target: myAgent, scorers: [scorer], data: inputs });

// Should not transform unrelated runExperiment from other packages
import { runExperiment as otherRun } from 'some-other-package';
const other = await otherRun({ data: 'test' });