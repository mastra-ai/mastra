import { ComposioToolset } from '@mastra/toolsets';

import { mastra } from './mastra';
import { sample } from './mastra/integrations';

async function main() {
  // Sample Integration

  const sampleToolset = await sample.getTools()

  // Composio Integration
  const toolset = new ComposioToolset({
    apiKey: process.env.COMPOSIO_API_KEY!,
    entityId: 'default',
    connectedAccountId: '899144e5-a466-428b-8a00-7c931fb57f9f',
  });

  const agent = mastra.getAgent('Notion agent');

  const composio = await toolset.getTools({});

  const res = await agent.generate('Search for a Notion page about query: "Kepler"', {
    toolsets: {
      composio,
      sample: sampleToolset,
    },
  });

  console.log(res.text);
}

main();
