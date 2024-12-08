import { randomUUID } from 'crypto';

import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('Chef Agent');
  const threadId = randomUUID();
  const resourceid = 'SOME_USER_ID';

  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';
  console.log(`Query 1: ${query1}`);

  const pastaResponse = await agent.text({
    messages: [query1],
    threadId,
    resourceid,
  });

  console.log('\n👨‍🍳 Chef Michel:', pastaResponse.text);
  console.log('\n-------------------\n');

  let messages = await mastra.memory?.getMessages({
    threadId,
  });

  console.log(JSON.stringify(messages, null, 2));

  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";

  console.log(`Query 2: ${query2}`);

  const curryResponse = await agent.text({
    messages: [query2],
    threadId,
    resourceid,
  });

  console.log('\n👨‍🍳 Chef Michel:', curryResponse.text);
  console.log('\n-------------------\n');

  messages = await mastra.memory?.getMessages({
    threadId,
  });

  console.log(JSON.stringify(messages, null, 2));
}

main();
