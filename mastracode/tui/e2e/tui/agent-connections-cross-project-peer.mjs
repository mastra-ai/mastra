// Peer Mastra Code agent for the agent-connections-cross-project scenario.
// It runs in its own process because the thread-stream runtime answers
// discovery once per process: a second agent in the E2E process would share
// its source id and never reply to it.
import { createOpenAI } from '@ai-sdk/openai';
import { createSignalsPubSub } from '@mastra/code-sdk/utils/signals-pubsub';
import { Agent } from '@mastra/core/agent';

const [resourceId, threadId, instructions] = process.argv.slice(2);
const emit = event => process.stdout.write(`${JSON.stringify(event)}\n`);

const pubsub = createSignalsPubSub(resourceId, { sharedAgentDiscovery: true });
const agent = new Agent({
  id: 'code-agent',
  name: 'Peer Reviewer',
  instructions,
  model: createOpenAI({
    baseURL: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    fetch: async (input, init) => {
      emit({ type: 'model-request', body: typeof init?.body === 'string' ? init.body : '' });
      return fetch(input, init);
    },
  })('gpt-5.4-mini'),
  pubsub,
});

const advertisement = await agent.claimThreadOwnership({
  resourceId,
  threadId,
  streamOptions: {},
  peer: {
    label: 'Peer Reviewer',
    title: 'Peer Reviewer',
    metadata: { mode: 'build', projectName: 'Other Project' },
  },
});
emit({ type: 'ready', pid: process.pid });

process.stdin.resume();
process.stdin.on('end', async () => {
  advertisement.unsubscribe();
  await pubsub.close();
  process.exit(0);
});
