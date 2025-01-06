import { Mastra } from '@mastra/core';

import { candidateWorkflow } from './workflows';

const mastra = new Mastra({
  workflows: {
    candidateWorkflow,
  },
});

(async () => {
  const workflow = mastra.getWorkflow('candidateWorkflow');
  const runResult = await workflow.execute({
    triggerData: { resumeText: 'Simulated resume content...' },
  });
  console.log('Final output:', runResult.results);
})();
