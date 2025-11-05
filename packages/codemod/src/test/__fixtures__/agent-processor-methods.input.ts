// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const inputProcessors = await agent.getInputProcessors(param);
const outputProcessors = await agent.getOutputProcessors(param);
