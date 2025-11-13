// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

await agent.voice.speak('Hello');
await agent.voice.listen();
const speakers = agent.voice.getSpeakers();
