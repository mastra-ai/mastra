import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactNode } from 'react';

import type { ResolvedWorkflowStep, WorkflowStepRenderers } from './types';
import { WorkflowStepFactory } from './WorkflowStepFactory';

const baseStep = (id: string) => ({
  id,
  description: `${id} description`,
});

const successfulResult = {
  status: 'success',
  payload: { input: true },
  output: { output: true },
  startedAt: 1,
  endedAt: 2,
} as const;

const allSteps: ResolvedWorkflowStep[] = [
  {
    kind: 'step',
    id: 'regular-step',
    step: baseStep('regular-step'),
    flow: { type: 'step', step: baseStep('regular-step') },
    result: successfulResult,
    workflowStatus: 'running',
  },
  {
    kind: 'map-step',
    id: 'map-step',
    step: { ...baseStep('map-step'), mapConfig: 'return { value: input.value }' },
    flow: { type: 'step', step: { ...baseStep('map-step'), mapConfig: 'return { value: input.value }' } },
    result: successfulResult,
    workflowStatus: 'running',
  },
  {
    kind: 'foreach-step',
    id: 'foreach-step',
    step: baseStep('foreach-step'),
    flow: { type: 'foreach', step: baseStep('foreach-step'), opts: { concurrency: 3 } },
    result: { ...successfulResult, status: 'running' },
    workflowStatus: 'running',
  },
  {
    kind: 'parallel-step',
    id: 'parallel-step',
    flow: {
      type: 'parallel',
      steps: [
        { type: 'step', step: baseStep('parallel-a') },
        { type: 'step', step: baseStep('parallel-b') },
      ],
    },
    workflowStatus: 'running',
  },
  {
    kind: 'conditional',
    id: 'conditional',
    flow: {
      type: 'conditional',
      steps: [
        { type: 'step', step: baseStep('when-true') },
        { type: 'step', step: baseStep('when-false') },
      ],
      serializedConditions: [
        { id: 'if-large', fn: 'input.value > 10' },
        { id: 'else-small', fn: 'input.value <= 10' },
      ],
    },
    workflowStatus: 'running',
  },
  {
    kind: 'loop-step',
    id: 'loop-step',
    step: baseStep('loop-step'),
    flow: {
      type: 'loop',
      step: baseStep('loop-step'),
      serializedCondition: { id: 'until-ready', fn: 'output.ready === true' },
      loopType: 'dountil',
    },
    result: { ...successfulResult, status: 'waiting' },
    workflowStatus: 'running',
  },
  {
    kind: 'sleep-step',
    id: 'sleep-step',
    flow: { type: 'sleep', id: 'sleep-step', duration: 5000 },
    result: { ...successfulResult, status: 'waiting' },
    workflowStatus: 'running',
  },
  {
    kind: 'sleep-until-step',
    id: 'sleep-until-step',
    flow: { type: 'sleepUntil', id: 'sleep-until-step', date: new Date('2026-01-01T00:00:00.000Z') },
    result: { ...successfulResult, status: 'waiting' },
    workflowStatus: 'running',
  },
  {
    kind: 'nested-workflow-step',
    id: 'nested-workflow-step',
    step: {
      ...baseStep('nested-workflow-step'),
      component: 'WORKFLOW',
      serializedStepFlow: [{ type: 'step', step: baseStep('nested-child') }],
    },
    flow: {
      type: 'step',
      step: {
        ...baseStep('nested-workflow-step'),
        component: 'WORKFLOW',
        serializedStepFlow: [{ type: 'step', step: baseStep('nested-child') }],
      },
    },
    workflowStatus: 'running',
  },
  {
    kind: 'unknown-step',
    id: 'unknown-step',
    step: baseStep('unknown-step'),
    flow: { type: 'step', step: baseStep('unknown-step') },
    workflowStatus: 'failed',
  },
];

const pageStyle: CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: 24,
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 12,
};

const cardStyle: CSSProperties = {
  border: '1px solid #d7dde6',
  borderRadius: 8,
  padding: 14,
  minHeight: 132,
  background: '#ffffff',
  color: '#172033',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  color: '#475569',
};

const codeStyle: CSSProperties = {
  display: 'block',
  marginTop: 10,
  padding: 8,
  borderRadius: 6,
  background: '#f6f8fb',
  color: '#334155',
  fontSize: 12,
  overflowWrap: 'anywhere',
};

const flowDetail = (step: ResolvedWorkflowStep): ReactNode => {
  switch (step.kind) {
    case 'map-step':
      return step.step?.mapConfig;
    case 'foreach-step':
      return `concurrency: ${step.flow.opts?.concurrency ?? 'default'}`;
    case 'parallel-step':
      return `branches: ${step.flow.steps.length}`;
    case 'conditional':
      return `conditions: ${step.flow.serializedConditions
        .map((condition: { id: string; fn: string }) => condition.id)
        .join(', ')}`;
    case 'loop-step':
      return `${step.flow.loopType}: ${step.flow.serializedCondition.id}`;
    case 'sleep-step':
      return `duration: ${step.flow.duration}ms`;
    case 'sleep-until-step':
      return step.flow.date ? `date: ${step.flow.date.toISOString()}` : 'date: unknown';
    case 'nested-workflow-step':
      return `child steps: ${step.step?.serializedStepFlow?.length ?? 0}`;
    default:
      return `flow type: ${step.flow.type}`;
  }
};

const StepCard = ({ label, step }: { label: string; step: ResolvedWorkflowStep }) => (
  <article style={cardStyle}>
    <div style={labelStyle}>{label}</div>
    <h3 style={{ margin: '6px 0 4px', fontSize: 16 }}>{step.id}</h3>
    <div style={{ fontSize: 13, color: '#526174' }}>
      status: {step.result?.status ?? step.workflowStatus ?? 'unknown'}
    </div>
    <code style={codeStyle}>{flowDetail(step)}</code>
  </article>
);

const renderers: WorkflowStepRenderers = {
  Step: step => <StepCard label="Step" step={step} />,
  MapStep: step => <StepCard label="MapStep" step={step} />,
  ForEachStep: step => <StepCard label="ForEachStep" step={step} />,
  ParallelStep: step => <StepCard label="ParallelStep" step={step} />,
  Conditional: step => <StepCard label="Conditional" step={step} />,
  LoopStep: step => <StepCard label="LoopStep" step={step} />,
  SleepStep: step => <StepCard label="SleepStep" step={step} />,
  SleepUntilStep: step => <StepCard label="SleepUntilStep" step={step} />,
  NestedWorkflowStep: step => <StepCard label="NestedWorkflowStep" step={step} />,
  UnknownStep: step => <StepCard label="UnknownStep" step={step} />,
};

const WorkflowStepFactoryStory = () => (
  <div style={pageStyle}>
    <div style={gridStyle}>
      {allSteps.map(step => (
        <WorkflowStepFactory key={step.id} step={step} {...renderers} />
      ))}
    </div>
  </div>
);

const meta = {
  title: 'Workflows/WorkflowStepFactory',
  component: WorkflowStepFactoryStory,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof WorkflowStepFactoryStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllNodes: Story = {};
