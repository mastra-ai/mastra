import { z } from 'zod';

import { mastra } from './mastra';

const specieSchema = z.object({
  species: z.string(),
});

const main = async () => {
  const agentCat = mastra.getAgent('catOne');

  try {
    const result = await agentCat.generate('What is the most popular cat species?', {
      output: specieSchema,
    });

    const res = specieSchema.parse(result?.object);

    console.log(res.species);

    const workflow = mastra.getWorkflow('logCatWorkflow');

    await workflow.execute({ triggerData: { name: res.species } });
  } catch (err) {
    console.error(err);
  }
};

main();
