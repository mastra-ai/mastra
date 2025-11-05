// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const inputProcessors = await agent.listInputProcessors(param);
const outputProcessors = await agent.listOutputProcessors(param);
