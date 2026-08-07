import type { Agent } from '@mastra/core/agent';
import {
  createDurableAgent,
  type DurableAgent,
  type DurableAgentStreamOptions,
  type DurableAgentStreamResult,
} from '@mastra/core/agent/durable';
import type { MastraServerCache } from '@mastra/core/cache';
import type { PubSub } from '@mastra/core/events';

import { CloudflareWorkflowExecutionEngine } from './execution-engine';
import type { CloudflareWorkflowBinding } from './types';

const CLOUDFLARE_WORKFLOW_AGENT = Symbol.for('@mastra/cloudflare-workflows/agent');

export interface CreateCloudflareWorkflowAgentOptions {
  agent: Agent<any, any, any>;
  workflow: CloudflareWorkflowBinding;
  id?: string;
  name?: string;
  pubsub?: PubSub;
  cache?: MastraServerCache | false;
  maxSteps?: number;
  cleanupTimeoutMs?: number;
  instanceId?: (runId: string) => string;
}

export type CloudflareWorkflowAgentStreamOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT>;
export type CloudflareWorkflowAgentStreamResult<OUTPUT = undefined> = DurableAgentStreamResult<OUTPUT>;

export type CloudflareWorkflowAgent<TOutput = undefined> = DurableAgent<string, Record<string, any>, TOutput> & {
  readonly workflowBinding: CloudflareWorkflowBinding;
  readonly [CLOUDFLARE_WORKFLOW_AGENT]: true;
};

export function createCloudflareWorkflowAgent<TOutput = undefined>(
  options: CreateCloudflareWorkflowAgentOptions,
): CloudflareWorkflowAgent<TOutput> {
  const { agent, workflow, id, name, pubsub, cache, maxSteps, cleanupTimeoutMs, instanceId } = options;
  const durableAgent = createDurableAgent({
    agent,
    id,
    name,
    pubsub,
    cache,
    maxSteps,
    cleanupTimeoutMs,
    executionEngine: new CloudflareWorkflowExecutionEngine({
      workflow,
      instanceId,
    }),
  }) as CloudflareWorkflowAgent<TOutput>;

  Object.defineProperties(durableAgent, {
    workflowBinding: {
      configurable: false,
      enumerable: true,
      get: () => workflow,
    },
    [CLOUDFLARE_WORKFLOW_AGENT]: {
      configurable: false,
      enumerable: false,
      value: true,
    },
  });

  return durableAgent;
}

export function isCloudflareWorkflowAgent(value: unknown): value is CloudflareWorkflowAgent {
  return (
    typeof value === 'object' &&
    value !== null &&
    CLOUDFLARE_WORKFLOW_AGENT in value &&
    value[CLOUDFLARE_WORKFLOW_AGENT] === true
  );
}
