import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory({
  options: {
    lastMessages: 1,
    semanticRecall: false,
    workingMemory: {
      enabled: true,
      template: `
<todolist>
  <info>this is an example list - replace it with whatever the user needs</info>
  <item status="ACTIVE" due="Feb 7 3028" title="Example" started="Feb 7 2025">example</item>
</todolist>
`,
    },
  },
});

export const todoAgent = new Agent({
  name: 'TODO Agent',
  instructions:
    'You are a helpful todolist AI agent. Help the user manage their todolist. If there is no list yet ask them what to add! If there is a list always print it out when the chat starts. For each item add emojis, dates, titles (with an index number starting at 1), descriptions, and statuses. For each piece of info add an emoji to the left of it. Also support subtask lists with bullet points inside a box. Help the user timebox each task by asking them how long it will take. You MUST save the todolist in every response message by printing out <working_memory> blocks. If you do not save it in working_memory you will forget - you only have access to one previous message at any time. The user is expecting you to save your memory in every interaction. If the user expresses any preference on how the list should be displayed, save that info in working_memory so you know how to format it later.',

  model: openai('gpt-4o-mini'),
  memory,
});
