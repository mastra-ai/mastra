import { Workflow } from '../resources/workflow';
import type { ClientOptions } from '../types';

/**
 * Workflow-only Mastra client for browser, Expo, and React Native applications.
 *
 * This entrypoint intentionally excludes agent, A2A, observability, and other
 * client resources so Metro can bundle the native workflow lifecycle without
 * traversing the full Client SDK barrel.
 */
export class MastraWorkflowClient {
  readonly options: ClientOptions;

  constructor(options: ClientOptions) {
    this.options = options;
  }

  getWorkflow(workflowId: string): Workflow {
    return new Workflow(this.options, workflowId);
  }
}

export function createWorkflowClient(options: ClientOptions): MastraWorkflowClient {
  return new MastraWorkflowClient(options);
}

export { Workflow } from '../resources/workflow';
export { Run } from '../resources/run';
export type { ClientOptions } from '../types';
export type {
  GetWorkflowResponse,
  GetWorkflowRunByIdResponse,
  ListWorkflowRunsParams,
  ListWorkflowRunsResponse,
  StreamVNextChunkType,
  TimeTravelParams,
  WorkflowRunResult,
} from '../types';
