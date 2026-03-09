// @ts-nocheck

import { toAISdkStream } from '@mastra/ai-sdk';

const stream = toAISdkStream(agentStream, { from: 'agent' });
