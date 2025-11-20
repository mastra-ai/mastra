// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

const llm = agent.getLLM();
const tools = agent.getTools();
const instructions = agent.getInstructions();
