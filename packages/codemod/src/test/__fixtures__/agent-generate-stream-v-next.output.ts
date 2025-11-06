// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const result = await agent.generate('Hello');
const stream = await agent.stream('Hello');
