import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('connectAgent');
  const response = await agent.generate('List the Slack channels available to me');
  console.log(response.text);
}

main().catch(console.error);
