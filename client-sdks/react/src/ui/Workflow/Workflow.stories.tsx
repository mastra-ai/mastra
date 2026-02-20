import type { Meta, StoryObj } from '@storybook/react-vite';

import { Workflow } from './Workflow';
import { StepCard, StepContent, StepHeader, StepStatus, StepTitle, StepActions, StepTimer } from './primitives';
import { LogIn, LogOut, Eye } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import { IconButton, IconButtonClass } from '../IconButton';
import { useState } from 'react';
import { WorkflowStatusType } from './types';
import { workflowResultFixture } from './fixtures/workflow-result.fixture';
import { workflowFixture } from './fixtures/workflow.fixture';

const Component = () => {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Workflow workflow={workflowFixture} workflowResult={workflowResultFixture} />
    </div>
  );
};

const meta = {
  title: 'Components/Workflow',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

const PrimitivesComponent = ({ status }: { status: WorkflowStatusType }) => {
  const [now] = useState(() => Date.now());
  return (
    <StepCard status={status}>
      <StepHeader>
        <StepStatus />
        <StepTitle>DefaultNode</StepTitle>
        {!['idle', 'suspended', 'waiting'].includes(status) && (
          <StepTimer startTime={now} endedAt={status !== 'running' ? now + 1000 : undefined} />
        )}
      </StepHeader>

      <StepContent>Hello world, this is some content</StepContent>

      <StepActions>
        <IconButton
          tooltip="Input"
          className={twMerge(IconButtonClass, 'mastra:border mastra:border-border1 mastra:p-1')}
        >
          <LogIn />
        </IconButton>

        <IconButton
          tooltip="Output"
          className={twMerge(IconButtonClass, 'mastra:border mastra:border-border1 mastra:p-1')}
        >
          <LogOut />
        </IconButton>

        <IconButton
          tooltip="Traces"
          className={twMerge(IconButtonClass, 'mastra:border mastra:border-border1 mastra:p-1')}
        >
          <Eye />
        </IconButton>
      </StepActions>
    </StepCard>
  );
};

export const Primitives: Story = {
  render: () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '300px' }}>
        <PrimitivesComponent status="running" />
        <PrimitivesComponent status="success" />
        <PrimitivesComponent status="failed" />
        <PrimitivesComponent status="suspended" />
        <PrimitivesComponent status="waiting" />
        <PrimitivesComponent status="idle" />
      </div>
    );
  },
};
