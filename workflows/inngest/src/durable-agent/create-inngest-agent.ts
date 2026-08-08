import type { Agent } from '@mastra/core/agent';
import {
  createDurableAgent,
  type DurableAgent,
  type DurableAgentStreamOptions,
  type DurableAgentStreamResult,
} from '@mastra/core/agent/durable';
import type { MastraServerCache } from '@mastra/core/cache';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { Inngest } from 'inngest';

import { InngestPubSub } from '../pubsub';
import { InngestDurableStepIds } from './create-inngest-agentic-workflow';
import { InngestDurableAgentExecutionEngine } from './inngest-execution-engine';

export interface CreateInngestAgentOptions {
  agent: Agent<any, any, any>;
  inngest: Inngest;
  id?: string;
  name?: string;
  pubsub?: PubSub;
  cache?: MastraServerCache;
  mastra?: Mastra;
  maxSteps?: number;
  cleanupTimeoutMs?: number;
}

export type InngestAgentStreamOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT>;
export type InngestAgentResumeOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT> & {
  toolCallId?: string;
};
export type InngestAgentStreamResult<OUTPUT = undefined> = DurableAgentStreamResult<OUTPUT>;

export type InngestAgent<TOutput = undefined> = DurableAgent<string, Record<string, any>, TOutput> & {
  readonly agent: Agent<any, any, TOutput>;
  readonly inngest: Inngest;
};

/**
 * Creates an Inngest-backed DurableAgent using the provider-neutral execution
 * contract from `@mastra/core`.
 */
export function createInngestAgent<TOutput = undefined>(options: CreateInngestAgentOptions): InngestAgent<TOutput> {
  const {
    agent,
    inngest,
    id,
    name,
    pubsub = new InngestPubSub(inngest, InngestDurableStepIds.AGENTIC_LOOP),
    cache,
    mastra,
    maxSteps,
    cleanupTimeoutMs,
  } = options;

  let durableAgent!: InngestAgent<TOutput>;
  const executionEngine = new InngestDurableAgentExecutionEngine(inngest, {
    getCache: () => durableAgent.cache,
  });
  durableAgent = createDurableAgent({
    agent,
    id,
    name,
    pubsub,
    cache,
    maxSteps,
    cleanupTimeoutMs,
    executionEngine,
  }) as InngestAgent<TOutput>;

  Object.defineProperties(durableAgent, {
    agent: {
      configurable: false,
      enumerable: true,
      get: () => agent,
    },
    inngest: {
      configurable: false,
      enumerable: true,
      get: () => inngest,
    },
  });

  if (mastra) {
    durableAgent.__setMastra(mastra);
  }

  return durableAgent;
}

export function isInngestAgent(value: unknown): value is InngestAgent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'agent' in value &&
    'inngest' in value &&
    'getDurableWorkflows' in value &&
    typeof value.getDurableWorkflows === 'function'
  );
}
