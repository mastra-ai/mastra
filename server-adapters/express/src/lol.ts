import { openai } from '@ai-sdk/openai';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import express from 'express';
import { ExpressServerAdapter } from '.';

const app = express();
app.use(express.json());

const newAgent = new Agent({
  id: 'new-agent',
  name: 'New Agent',
  instructions: 'This is a new agent',
  model: openai('gpt-4o'),
});
const mastra = new Mastra({
  agents: {
    newAgent,
  },
});

const expressServerAdapter = new ExpressServerAdapter({ mastra });
await expressServerAdapter.registerRoutes(app);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
