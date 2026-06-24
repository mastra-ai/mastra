import type { SerializedStepFlowEntry } from '@mastra/core/workflows';
import type { ReactNode } from 'react';

import type { ForeachProgress, Step } from '../../context/use-current-run';
import type { Condition } from '../utils';

export type WorkflowCardDisplayStatus = Step['status'] | 'tripwire' | undefined;

export type WorkflowCardCondition = Condition;

export type WorkflowConditionCodeCondition = Extract<WorkflowCardCondition, { fnString: string }>;

export interface WorkflowStepCardViewProps {
  label: string;
  description?: string;
  displayStatus?: WorkflowCardDisplayStatus;
  hasStep?: boolean;
  isNestedWorkflowStep?: boolean;
  stepKey?: string;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
  duration?: number;
  date?: Date;
  isForEach?: boolean;
  foreachProgress?: ForeachProgress;
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
  hasPreviousStep?: boolean;
  hasNextStep?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openDialog: boolean;
  onOpenDialogChange: (open: boolean) => void;
  dialogCondition?: WorkflowConditionCodeCondition;
  onConditionClick: (condition: WorkflowConditionCodeCondition) => void;
  actionBar?: ReactNode;
}
