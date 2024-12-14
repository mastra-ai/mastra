import { mastra } from './mastra';
import { composio, sample } from './mastra/integrations';

async function main() {
  const sampleToolset = await sample.getTools()
  const composioToolset = await composio.getTools({});

  const agent = mastra.getAgent('agent');

  const res = await agent.generate('Search for a Notion page about query: "Kepler"', {
    toolsets: {
      composio: composioToolset,
      sample: sampleToolset,
    },
  });

  console.log(res.text);
}

main();
