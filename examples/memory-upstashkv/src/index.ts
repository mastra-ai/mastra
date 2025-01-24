import { randomUUID } from 'crypto';

import { bubble } from './bubble';
import { mastra } from './mastra';

async function main() {
  const agent = mastra.getAgent('chefAgent');
  const threadId = randomUUID();
  const resourceid = 'SOME_USER_ID';

  const query1 =
    'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make?';

  await agent.generate(query1, {
    threadId,
    resourceid,
  });

  console.log('\n👨‍🍳 Thread w/ Chef Michel:');
  let messages = await mastra.memory?.getMessages({
    threadId,
  });

  messages?.messages?.forEach(message => {
    if (Array.isArray(message.content)) {
      message.content.forEach(content => {
        bubble.print(content.text);
      });
    } else {
      bubble.print(message.content);
    }
  });

  const query2 =
    "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.";
  await agent.generate(query2, {
    threadId,
    resourceid,
  });

  messages = await mastra.memory?.getMessages({
    threadId,
  });

  messages?.messages?.forEach(message => {
    if (Array.isArray(message.content)) {
      message.content.forEach(content => {
        bubble.print(content.text);
      });
    } else {
      bubble.print(message.content);
    }
  });

  const m = await mastra.memory?.getContextWindow({
    threadId,
    format: 'core_message',
  });

  const res = await agent.generate('What did we cook before I went to my friends house?', { context: m });

  console.log(res.text);
}

main();
