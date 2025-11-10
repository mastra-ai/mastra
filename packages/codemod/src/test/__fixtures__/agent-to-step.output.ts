// @ts-nocheck

import { Agent } from '@mastra/core/agent';

const agent = new Agent({});

/* FIXME(mastra): The toStep() method has been removed. See: https://mastra.ai/guides/v1/migrations/upgrade-to-v1/agent#agenttostep-method */
const step = agent.toStep();
