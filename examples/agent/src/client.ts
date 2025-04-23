import { MastraClient } from '@mastra/client-js';

async function main() {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  const agent = client.getAgent('chefAgent');

  const response = await agent.generate({
    messages: 'What is the best pasta dish?',
    threadId: '12334',
    resourceId: '12334',
  });

  const memoryThread = await client.getMemoryThread('12334', 'chefAgent').getMessages();

  console.log(memoryThread);
  console.log(response.text);

  const audioResponse = await agent.voice.speak(response.text);

  console.log(audioResponse);
}

main();
