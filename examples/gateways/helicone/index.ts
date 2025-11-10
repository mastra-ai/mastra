import 'dotenv/config';
import { Agent } from '@mastra/core/agent';

async function main() {
  const agent = new Agent({
    id: 'helicone-test',
    name: 'Helicone Test',
    instructions: 'You are a concise assistant.',
    model: 'helicone/openai/gpt-4o-mini',
  });

  const res = await agent.generate('In one sentence, say hello from Helicone via Mastra.');

  console.log('Response:\n', res.text);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
