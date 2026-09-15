import type { SerializedStepFlowEntry, WorkflowStepStatus } from '@mastra/core/workflows';
import type { ReactNode } from 'react';

export type WorkflowCardDisplayStatus = WorkflowStepStatus | 'tripwire' | undefined;

export type WorkflowConditionType = 'if' | 'else' | 'when' | 'until' | 'while' | 'dountil' | 'dowhile';

export type WorkflowCardCondition =
  | {
      type: WorkflowConditionType;
      ref: {
        step:
          | {
              id: string;
            }
          | 'trigger';
        path: string;
      };
      query: Record<string, unknown>;
      conj?: 'and' | 'or' | 'not';
      fnString?: never;
    }
  | {
      type: WorkflowConditionType;
      fnString: string;
      ref?: never;
      query?: never;
      conj?: never;
    };

export interface WorkflowStepCardViewProps {
  label: string;
  nodeKind?: 'step' | 'agent' | 'tool' | 'map' | 'delay' | 'wait-until';
  onSelect?: () => void;
  body?: ReactNode;
  bodyLayout?: 'content' | 'graph';
  initiallyOpen?: boolean;
  onOpenBody?: () => void;
  description?: string;
  displayStatus?: WorkflowCardDisplayStatus;
  isNestedWorkflowStep?: boolean;
  stepKey?: string;
  isSelected?: boolean;
  isWaiting?: boolean;
  isHovered?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
  duration?: number;
  date?: Date;
  isForEach?: boolean;
  foreachProgress?: {
    completedCount: number;
    totalCount: number;
    iterationStatus: 'success' | 'failed' | 'suspended';
  };
  mapConfig?: string;
  canSuspend?: boolean;
  isParallel?: boolean;
  stepGraph?: SerializedStepFlowEntry[];
  startedAt?: number;
  endedAt?: number;
  actionBar?: ReactNode;
}

export interface WorkflowConditionCardViewProps {
  type?: WorkflowCardCondition['type'];
  conditions: WorkflowCardCondition[];
  previousDisplayStatus?: WorkflowCardDisplayStatus;
  actionBar?: ReactNode;
}
