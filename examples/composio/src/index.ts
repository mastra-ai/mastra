import { ComposioToolset } from '@mastra/toolsets';

import { createMastra } from './mastra';

async function main() {
  const toolset = new ComposioToolset({
    apiKey: process.env.COMPOSIO_API_KEY!,
    entityId: 'default',
    connectedAccountId: '899144e5-a466-428b-8a00-7c931fb57f9f',
  });

  const tools = await toolset.getTools({});

  const mastra = createMastra(tools);

  const agent = mastra.getAgent('Notion agent');

  const res = await agent.text({
    messages: ['Search for a Notion page about query: "Kepler"'],
  });

  console.log(res.text);
}

main();
