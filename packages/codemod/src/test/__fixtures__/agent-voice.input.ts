// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

await agent.speak('Hello');
await agent.listen();
const speakers = agent.getSpeakers();
