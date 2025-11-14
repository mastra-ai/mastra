// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const result = await agent.generateVNext('Hello');
const stream = await agent.streamVNext('Hello');
