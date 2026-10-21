import type { AddDatasetItemParams } from '@mastra/client-js';

export type TrajectoryExpectation = NonNullable<AddDatasetItemParams['expectedTrajectory']>;
export type ExpectedStep = NonNullable<TrajectoryExpectation['steps']>[number];
export type ExpectedStepType = NonNullable<ExpectedStep['stepType']>;
export type TrajectoryOrdering = NonNullable<TrajectoryExpectation['ordering']>;

/** `generic` matches a step by name only: it is sent without a `stepType`. */
export type StepTypeOption = ExpectedStepType | 'generic';

export const STEP_TYPE_LABELS = {
  tool_call: 'Tool call',
  mcp_tool_call: 'MCP tool call',
  model_generation: 'Model generation',
  agent_run: 'Agent run',
  workflow_step: 'Workflow step',
  workflow_run: 'Workflow run',
  workflow_conditional: 'Workflow conditional',
  workflow_parallel: 'Workflow parallel',
  workflow_loop: 'Workflow loop',
  workflow_sleep: 'Workflow sleep',
  workflow_wait_event: 'Workflow wait event',
  processor_run: 'Processor run',
} satisfies Record<ExpectedStepType, string>;

const isExpectedStepType = (value: string): value is ExpectedStepType => value in STEP_TYPE_LABELS;

export const isStepTypeOption = (value: string): value is StepTypeOption =>
  value === 'generic' || isExpectedStepType(value);

export const STEP_TYPE_OPTIONS: Array<{ value: StepTypeOption; label: string }> = [
  ...Object.keys(STEP_TYPE_LABELS)
    .filter(isExpectedStepType)
    .map(value => ({ value, label: STEP_TYPE_LABELS[value] })),
  { value: 'generic', label: 'Any step' },
];

export const ORDERING_LABELS = {
  strict: 'Strict',
  relaxed: 'Relaxed',
  unordered: 'Unordered',
} satisfies Record<TrajectoryOrdering, string>;

export const isTrajectoryOrdering = (value: string): value is TrajectoryOrdering => value in ORDERING_LABELS;

export const isToolStepType = (stepType: StepTypeOption): stepType is 'tool_call' | 'mcp_tool_call' =>
  stepType === 'tool_call' || stepType === 'mcp_tool_call';

/** One row of the trajectory editor. `id` only keys the row in React and is never sent. */
export interface TrajectoryStepRow {
  id: string;
  stepType: StepTypeOption;
  name: string;
  /** Raw JSON for a tool step's expected args; blank sends none. */
  toolArgs: string;
  /**
   * The step this row was prefilled from. Its details the editor doesn't show (tool result, model, …) are sent
   * along; it is dropped when the step type changes, since those details belong to the old type.
   */
  recorded?: ExpectedStep;
}

export const newTrajectoryStep = (): TrajectoryStepRow => ({
  id: crypto.randomUUID(),
  stepType: 'tool_call',
  name: '',
  toolArgs: '',
});

export const toTrajectoryStepRow = (step: ExpectedStep): TrajectoryStepRow => ({
  id: crypto.randomUUID(),
  stepType: step.stepType ?? 'generic',
  name: step.name,
  toolArgs: 'toolArgs' in step && step.toolArgs ? JSON.stringify(step.toolArgs, null, 2) : '',
  recorded: step,
});

const EDITED_KEYS = new Set(['name', 'stepType', 'toolArgs']);

/** The recorded details a row sends without showing them. */
export const recordedDetails = (row: TrajectoryStepRow): string[] =>
  row.recorded ? Object.keys(row.recorded).filter(key => !EDITED_KEYS.has(key)) : [];
