import { z } from 'zod';

import { mastra, storage } from './mastra';

const main = async () => {
  // setTimeout(() => {}, 30e3);
  await storage.init();
  try {
    const wf = mastra.getWorkflow('logCatWorkflow');
    const { start, runId } = wf.createRun();

    const initialResults = await start({ triggerData: { name: 'yello' } });
    console.log('initial results', initialResults);

    // const finalResults = await wf.resumeWithEvent(initialResults.runId, 'cat-event', { catName: 'Fluffy' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    const finalResults = await wf.resume({
      runId,
      // stepId: 'lol2',
      stepId: 'logCatName',
      // stepId: 'suspendStep',
      context: { catName: 'Fluffy' },
    });
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('final results', finalResults);
  } catch (err) {
    console.error('=====ERROR=====', err);
  }
};

main()
  .then(() => {
    console.log('done');
  })
  .catch(e => {
    console.log('ERR', e);
  });
