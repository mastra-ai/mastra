/**
 * Durable Agents Example
 *
 * This example demonstrates three patterns for durable agent execution,
 * with Redis cache for resumable streams:
 *
 * 1. Plain Durable Agent - resumable streams only, execution in HTTP request
 * 2. Evented Agent - resumable streams + fire-and-forget execution via workflow engine
 * 3. Inngest Agent - resumable streams + Inngest-powered durable execution
 */

import { Mastra } from '@mastra/core';
import { EventEmitterPubSub } from '@mastra/core/events';
import { serve as inngestServe } from '@mastra/inngest';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { RedisServerCache } from '@mastra/redis';
import Redis from 'ioredis';

import { inngest } from './workflows/inngest';
import {
  durableResearchAgent,
  eventedResearchAgent,
  inngestResearchAgent,
  regularResearchAgent,
} from './agents/research-agent';

const storage = new LibSQLStore({
  id: 'mastra-storage',
  url: 'file:./mastra.db',
});

// Redis cache for resumable streams - events persist across reconnections
const cache = new RedisServerCache({ client: new Redis('redis://localhost:6379') });

// EventEmitter pubsub for real-time delivery (process-local)
const pubsub = new EventEmitterPubSub();

export const mastra = new Mastra({
  agents: {
    // Plain durable agent - resumable streams only
    durableResearchAgent,

    // Evented agent - resumable streams + fire-and-forget execution
    eventedResearchAgent,

    // Inngest agent - resumable streams + Inngest-powered execution
    inngestResearchAgent,

    // Regular agent for comparison
    regularResearchAgent,
  },
  storage,
  cache,
  pubsub,
  server: {
    host: '0.0.0.0',
    apiRoutes: [
      {
        path: '/api/inngest',
        method: 'ALL',
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
    ],
  },
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
