import { mastra } from './mastra';
import { logCatWorkflow } from './mastra/workflow';

const main = async () => {
  const agentCat = mastra.getAgent('catOne');

  try {
    const result = await agentCat.textObject({
      messages: ['What is the most popular cat species?'],
      structuredOutput: {
        catSpecies: {
          type: 'object',
          items: {
            species: {
              type: 'string',
            },
          },
        },
      },
    });
    const {
      catSpecies: { species },
    } = (await result.toJsonResponse().json()) as { catSpecies: { species: string } };

    const workflow = mastra.getWorkflow('logCatWorkflow');
    await workflow.execute({ triggerData: { name: species } });

    // console.log(species);
  } catch (err) {
    console.error(err);
  }
};
main();
