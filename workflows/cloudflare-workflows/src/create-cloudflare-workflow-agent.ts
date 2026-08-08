import type { Agent } from '@mastra/core/agent';
import {
  createDurableAgent,
  type DurableAgent,
  type DurableAgentStreamOptions,
  type DurableAgentStreamResult,
  type DurableAgentStepLimit,
} from '@mastra/core/agent/durable';
import type { MastraServerCache } from '@mastra/core/cache';
import type { PubSub } from '@mastra/core/events';

import { CloudflareWorkflowExecutionEngine } from './execution-engine';
import type { CloudflareWorkflowBinding } from './types';

const CLOUDFLARE_WORKFLOW_AGENT = Symbol.for('@mastra/cloudflare-workflows/agent');

/** Configuration for a Mastra durable agent backed by Cloudflare Workflows. */
export interface CreateCloudflareWorkflowAgentOptions {
  /** Mastra agent whose execution is made durable. */
  agent: Agent<any, any, any>;
  /** Cloudflare Workflows binding used for durable instances. */
  workflow: CloudflareWorkflowBinding;
  /** Optional durable-agent ID override. */
  id?: string;
  /** Optional durable-agent display name override. */
  name?: string;
  /** Optional Mastra event transport. */
  pubsub?: PubSub;
  /** Optional stream replay cache, or `false` to disable caching. */
  cache?: MastraServerCache | false;
  /** Maximum agent-loop iterations, or `false` for no step ceiling. */
  maxSteps?: DurableAgentStepLimit;
  /** Delay before completed in-process run state is released. */
  cleanupTimeoutMs?: number;
  /** Optional mapping from Mastra run IDs to Cloudflare instance IDs. */
  instanceId?: (runId: string) => string;
}

/** Stream options accepted by a Cloudflare-backed durable agent. */
export type CloudflareWorkflowAgentStreamOptions<OUTPUT = undefined> = DurableAgentStreamOptions<OUTPUT>;
/** Stream result returned by a Cloudflare-backed durable agent. */
export type CloudflareWorkflowAgentStreamResult<OUTPUT = undefined> = DurableAgentStreamResult<OUTPUT>;

/** Mastra durable agent augmented with its Cloudflare Workflows binding. */
export type CloudflareWorkflowAgent<TOutput = undefined> = DurableAgent<string, Record<string, any>, TOutput> & {
  readonly workflowBinding: CloudflareWorkflowBinding;
  readonly [CLOUDFLARE_WORKFLOW_AGENT]: true;
};

/** Creates a Mastra durable agent whose provider lifecycle runs on Cloudflare Workflows. */
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

/** Returns whether a value was created by {@link createCloudflareWorkflowAgent}. */
export function isCloudflareWorkflowAgent(value: unknown): value is CloudflareWorkflowAgent {
  return (
    typeof value === 'object' &&
    value !== null &&
    CLOUDFLARE_WORKFLOW_AGENT in value &&
    value[CLOUDFLARE_WORKFLOW_AGENT] === true
  );
}
