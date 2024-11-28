import { mastra } from './mastra';
import { logCatWorkflow } from './mastra/workflow';

const main = async () => {
  const agentCat = mastra.getAgent('cat-one');

  try {
    const result = await agentCat.textObject({
      messages: ['What is the most popular cat specie?'],
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
    console.log(species);
    //replace clg with workflow
    await logCatWorkflow.execute({ name: species });
  } catch (err) {
    console.error(err);
  }
};
main();
