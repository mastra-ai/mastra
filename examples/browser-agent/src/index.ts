import { agentBrowserAgent, agentBrowserToolset } from './mastra/agents';

async function main() {
  const query = process.argv[2] || 'Go to https://news.ycombinator.com and tell me the top 5 stories on the front page';

  console.log(`\n🌐 Browser Agent`);
  console.log(`Query: ${query}\n`);

  try {
    const result = await agentBrowserAgent.generate(query, { maxSteps: 20 });
    console.log(`\n📄 Response:\n${result.text}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await agentBrowserToolset.close();
    console.log('\n✅ Browser closed');
  }
}

main();
