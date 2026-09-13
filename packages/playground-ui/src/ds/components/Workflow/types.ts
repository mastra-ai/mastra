import type { SerializedStepFlowEntry, WorkflowStepStatus } from '@mastra/core/workflows';
import type { ReactNode } from 'react';

export type WorkflowCardDisplayStatus =
  | Extract<WorkflowStepStatus, 'running' | 'success' | 'failed' | 'suspended' | 'waiting' | 'skipped'>
  | 'tripwire'
  | undefined;

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

export type WorkflowConditionCodeCondition = Extract<WorkflowCardCondition, { fnString: string }>;

export interface WorkflowStepCardViewProps {
  label: string;
  description?: string;
  displayStatus?: WorkflowCardDisplayStatus;
  hasStep?: boolean;
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
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openDialog: boolean;
  onOpenDialogChange: (open: boolean) => void;
  dialogCondition?: WorkflowConditionCodeCondition;
  onConditionClick: (condition: WorkflowConditionCodeCondition) => void;
  actionBar?: ReactNode;
}
