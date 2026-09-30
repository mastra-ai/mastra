import type { AnyWorkflow } from '@mastra/core/workflows';
import type { Manifest } from './manifest.js';
import type { TaskPolicy } from './policy.js';
import type { RenderProvider } from './provider.js';

export interface WorkflowBinding {
  workflow: AnyWorkflow;
  provider: RenderProvider;
  rootPolicy: TaskPolicy;
  manifest(ancestors?: ReadonlySet<AnyWorkflow>): Manifest;
}

export const workflowBindings = new WeakMap<AnyWorkflow, WorkflowBinding>();
