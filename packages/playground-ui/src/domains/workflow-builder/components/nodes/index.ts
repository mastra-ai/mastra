import { TriggerNode } from './trigger-node';
import { AgentNode } from './agent-node';
import { ToolNode } from './tool-node';
import { ConditionNode } from './condition-node';
import { ParallelNode } from './parallel-node';
import { LoopNode } from './loop-node';
import { ForeachNode } from './foreach-node';
import { TransformNode } from './transform-node';
import { SuspendNode } from './suspend-node';
import { WorkflowNode } from './workflow-node';
import { SleepNode } from './sleep-node';
import { AgentNetworkNode } from './agent-network-node';

export const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  condition: ConditionNode,
  parallel: ParallelNode,
  loop: LoopNode,
  foreach: ForeachNode,
  transform: TransformNode,
  suspend: SuspendNode,
  workflow: WorkflowNode,
  sleep: SleepNode,
  'agent-network': AgentNetworkNode,
} as const;

export { BaseNode } from './base-node';
export { TriggerNode } from './trigger-node';
export { AgentNode } from './agent-node';
export { ToolNode } from './tool-node';
export { ConditionNode } from './condition-node';
export { ParallelNode } from './parallel-node';
export { LoopNode } from './loop-node';
export { ForeachNode } from './foreach-node';
export { TransformNode } from './transform-node';
export { SuspendNode } from './suspend-node';
export { WorkflowNode } from './workflow-node';
export { SleepNode } from './sleep-node';
export { AgentNetworkNode } from './agent-network-node';
