import { StepWithMetadata } from '../types';

type NodeData = {
  id: string;
  description: string;
  condition?: string;
};

export const getNodeData = (node: StepWithMetadata): NodeData => {
  switch (node.type) {
    case 'waitForEvent':
    case 'foreach':
    case 'loop':
    case 'step':
      return {
        id: node.step.id,
        description: node.step.description ?? '',
        condition: node.condition,
      };
    case 'sleep':
      return {
        id: node.id,
        description: node.duration ? `${node.duration}ms` : '',
        condition: node.condition,
      };

    case 'sleepUntil':
      return {
        id: node.id,
        description: node.date ? `${node.date.toISOString()}` : '',
        condition: node.condition,
      };

    default:
      return {
        id: 'unknown',
        description: 'unknown',
      };
  }
};
