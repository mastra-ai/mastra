import type { FullOutput } from '@mastra/core/stream';
import type { AnyWorkflow } from '@mastra/core/workflows';
import type { BillingResponse } from './accounting.js';
import type {
  AgentResource,
  WorkflowResource,
  AgentProjection,
  NativeWorkflowResult,
  WorkflowProjection,
  WorkflowOutput,
} from './mastra-resources.js';
type Receipt = BillingResponse['billing'];
export type GenerationResponse<Output> =
  | {
      readonly kind: 'immediate';
      readonly result: FullOutput<Output>;
      readonly projection: AgentProjection<Output>;
      readonly billing: Receipt;
    }
  | { readonly kind: 'replay'; readonly result: AgentProjection<Output> | null; readonly billing: Receipt }
  | { readonly kind: 'nested'; readonly result: FullOutput<Output>; readonly parentExecutionId: string };
export type WorkflowResponse<W extends AnyWorkflow> =
  | {
      readonly kind: 'immediate';
      readonly result: NativeWorkflowResult<W>;
      readonly projection: WorkflowProjection<WorkflowOutput<W>>;
      readonly billing: Receipt;
    }
  | {
      readonly kind: 'replay';
      readonly result: WorkflowProjection<WorkflowOutput<W>>;
      readonly billing: Receipt | null;
    };

export type AgentRegistry = Record<string, AgentResource<any>>;
export type WorkflowRegistry = Record<string, WorkflowResource<any>>;
export type AgentResult<R> = R extends AgentResource<infer Output> ? Output : never;
export type NativeWorkflow<R> = R extends WorkflowResource<infer W> ? W : never;
