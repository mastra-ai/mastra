import type { DurableAgentEngineContext } from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import { RequestContext } from '@mastra/core/request-context';
import type { Workflow } from '@mastra/core/workflows';

import type {
  CloudflareWorkflowAgentParams,
  CloudflareWorkflowAgentStepRequest,
  CloudflareWorkflowAgentStepResult,
} from './types';

export { createCloudflareWorkflowStepExecutor, runCloudflareWorkflowAgent } from './worker';
export type {
  CloudflareFetcher,
  CreateCloudflareWorkflowStepExecutorOptions,
  RunCloudflareWorkflowAgentOptions,
} from './worker';

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

export type { CloudflareWorkflowAgentParams };
