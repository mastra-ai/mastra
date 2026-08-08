import type { DurableAgentEngineContext } from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import type { Workflow } from '@mastra/core/workflows';

import { CLOUDFLARE_WORKFLOW_AGENT_RESUME_EVENT } from './constants';
import type {
  CloudflareWorkflowAgentParams,
  CloudflareWorkflowAgentResumeEvent,
  CloudflareWorkflowAgentStepRequest,
  CloudflareWorkflowAgentStepResult,
  CloudflareWorkflowEvent,
  CloudflareWorkflowStep,
  CloudflareWorkflowStepExecutor,
} from './types';

/** Configuration for a Cloudflare Workflow entrypoint invocation. */
export interface RunCloudflareWorkflowAgentOptions {
  event: CloudflareWorkflowEvent;
  step: CloudflareWorkflowStep;
  executor: CloudflareWorkflowStepExecutor;
  retries?: {
    limit: number;
    delay: string | number;
    backoff?: 'constant' | 'linear' | 'exponential';
  };
  stepTimeout?: string | number;
  resumeTimeout?: string | number;
}

function assertSettledSegment(result: CloudflareWorkflowAgentStepResult): void {
  if (result.status === 'running' || result.status === 'pending' || result.status === 'waiting') {
    throw new Error(`Mastra step executor returned unsettled status "${result.status}"`);
  }
  if (result.status === 'failed' || result.status === 'tripwire' || result.status === 'bailed') {
    throw new Error(result.error?.message ?? `Mastra durable segment ${result.status}`);
  }
}

/** Runs Mastra workflow segments inside Cloudflare durable steps until completion. */
export async function runCloudflareWorkflowAgent(
  options: RunCloudflareWorkflowAgentOptions,
): Promise<CloudflareWorkflowAgentStepResult> {
  const { event, step, executor } = options;
  const retryConfig = options.retries ?? {
    limit: 5,
    delay: '10 seconds',
    backoff: 'exponential',
  };
  const stepConfig = {
    retries: retryConfig,
    timeout: options.stepTimeout ?? '30 minutes',
  };

  const startRequest: CloudflareWorkflowAgentStepRequest = {
    operation: 'start',
    runId: event.payload.runId,
    idempotencyKey: `${event.payload.runId}:start`,
    input: event.payload.input,
    requestContext: event.payload.requestContext,
    actor: event.payload.actor,
  };
  let segment = await step.do(startRequest.idempotencyKey, stepConfig, () => executor.execute(startRequest));
  assertSettledSegment(segment);

  let resumeIndex = 0;
  while (segment.status === 'suspended') {
    const resumeEvent = await step.waitForEvent<CloudflareWorkflowAgentResumeEvent>(`mastra-wait-${resumeIndex}`, {
      type: CLOUDFLARE_WORKFLOW_AGENT_RESUME_EVENT,
      timeout: options.resumeTimeout ?? '365 days',
    });
    resumeIndex += 1;
    const resumeRequest: CloudflareWorkflowAgentStepRequest = {
      operation: 'resume',
      runId: event.payload.runId,
      idempotencyKey: `${event.payload.runId}:resume:${resumeIndex}`,
      resumeData: resumeEvent.payload.resumeData,
      label: resumeEvent.payload.label,
      requestContext: resumeEvent.payload.requestContext,
      actor: resumeEvent.payload.actor,
    };
    segment = await step.do(resumeRequest.idempotencyKey, stepConfig, () => executor.execute(resumeRequest));
    assertSettledSegment(segment);
  }

  return segment;
}

/** Inputs for executing one Cloudflare-delivered segment on a Mastra workflow. */
export interface ExecuteCloudflareWorkflowAgentStepOptions {
  workflow: Workflow<any, any, any, any, any, any, any>;
  pubsub: PubSub;
  request: CloudflareWorkflowAgentStepRequest;
  requestContext?: RequestContext;
  actor?: DurableAgentEngineContext['actor'];
}

/** Rehydrates request metadata and executes one start or resume segment in Mastra. */
export async function executeCloudflareWorkflowAgentStep(
  options: ExecuteCloudflareWorkflowAgentStepOptions,
): Promise<CloudflareWorkflowAgentStepResult> {
  const { workflow, pubsub, request, requestContext, actor } = options;
  const effectiveRequestContext =
    requestContext ??
    (request.requestContext ? new RequestContext(Object.entries(request.requestContext)) : undefined);
  const effectiveActor = actor ?? request.actor;
  const run = await workflow.createRun({ runId: request.runId, pubsub });
  const result =
    request.operation === 'start'
      ? await run.start({
          inputData: request.input,
          requestContext: effectiveRequestContext,
          actor: effectiveActor,
        })
      : await run.resume({
          resumeData: request.resumeData,
          label: request.label,
          requestContext: effectiveRequestContext,
          actor: effectiveActor,
        });

  return {
    status: result.status,
    error:
      result.status === 'failed'
        ? {
            message: result.error?.message ?? 'Mastra durable segment failed',
          }
        : undefined,
    output: 'result' in result ? result.result : undefined,
  };
}

/** Fetch-compatible transport used by the HTTP step executor. */
export interface CloudflareFetcher {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
}

/** Configuration for an HTTP-backed Cloudflare step executor. */
export interface CreateCloudflareWorkflowStepExecutorOptions {
  fetcher: CloudflareFetcher;
  path?: string;
  headers?: Record<string, string>;
}

/** Creates a Cloudflare step executor that calls a Mastra HTTP endpoint. */
export function createCloudflareWorkflowStepExecutor(
  options: CreateCloudflareWorkflowStepExecutorOptions,
): CloudflareWorkflowStepExecutor {
  return {
    async execute(request) {
      const response = await options.fetcher.fetch(
        new Request(new URL(options.path ?? '/__mastra/cloudflare-workflow-step', 'https://mastra.internal'), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...options.headers,
          },
          body: JSON.stringify(request),
        }),
      );
      if (!response.ok) {
        throw new Error(`Mastra step executor failed (${response.status}): ${await response.text()}`);
      }
      return (await response.json()) as CloudflareWorkflowAgentStepResult;
    },
  };
}

export type { CloudflareWorkflowAgentParams };
