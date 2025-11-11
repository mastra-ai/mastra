// @ts-nocheck
import { createScorer, runExperiment } from '@mastra/core/evals';
import { myAgent } from './agents/my-agent';

const scorer = createScorer({
  id: 'helpfulness-scorer',
  // ...
});

const result = await runExperiment({ target: myAgent, scorers: [scorer], data: inputs });

// Multiple calls
const result2 = await runExperiment({ target: myAgent, scorers: [scorer], data: inputs });

// Should not transform unrelated runExperiment from other packages
import { runExperiment as otherRun } from 'some-other-package';
const other = await otherRun({ data: 'test' });