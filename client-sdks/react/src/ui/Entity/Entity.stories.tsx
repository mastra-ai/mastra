import type { Meta, StoryObj } from '@storybook/react-vite';
import { twMerge } from 'tailwind-merge';

import { Entity, EntityTrigger, EntityContent, EntityTriggerClass, EntityCaret } from './Entity';
import { Entry, EntryTitle } from './Entry';
import { Icon } from '../Icon/Icon';
import { AgentIcon } from '../Icons/AgentIcon';
import { CodeBlock, CodeCopyButton } from '../Code/Code';
import { EntityVariant } from './types';
import {
  ToolApproval,
  ToolApprovalActions,
  ToolApprovalContent,
  ToolApprovalHeader,
  ToolApprovalTitle,
} from './ToolApproval';

import { IconButton } from '../IconButton';
import { CheckIcon, XIcon } from 'lucide-react';

interface ComponentProps {
  className?: string;
  additionalClass?: string;
  variant?: EntityVariant;
  requireApproval?: boolean;
}

const input = `{ "city": "Paris" }`;
const output = `{
  "city": "Paris",
  "weather": "sunny",
  "temperature_celsius": 19,
  "temperature_fahrenheit": 66,
  "humidity": 50,
  "wind": "10 mph",
}`;

const Component = ({ className, additionalClass, variant, requireApproval }: ComponentProps) => {
  const entityTriggerClass = additionalClass ? twMerge(EntityTriggerClass, additionalClass) : className;

  return (
    <Entity className={className} variant={variant} disabled={requireApproval}>
      <EntityTrigger className={entityTriggerClass}>
        <Icon>
          <AgentIcon />
        </Icon>
        Entity Badge
        <EntityCaret />
      </EntityTrigger>

      <EntityContent className={className}>
        <Entry>
          <EntryTitle>Tool input</EntryTitle>
          <CodeBlock code={input} language="json" cta={<CodeCopyButton code={input} />} />
        </Entry>

        <Entry>
          <EntryTitle>Tool output</EntryTitle>
          <CodeBlock cta={<CodeCopyButton code={output} />} code={output} language="json" />
        </Entry>
      </EntityContent>

      {requireApproval && (
        <ToolApproval>
          <ToolApprovalHeader>
            <ToolApprovalTitle>Tool approval required</ToolApprovalTitle>

            <ToolApprovalActions>
              <IconButton tooltip="Approve" size="lg">
                <CheckIcon />
              </IconButton>
              <IconButton tooltip="Decline" size="lg">
                <XIcon />
              </IconButton>
            </ToolApprovalActions>
          </ToolApprovalHeader>

          <ToolApprovalContent>
            <Entry>
              <EntryTitle>weather_info</EntryTitle>
              <CodeBlock cta={<CodeCopyButton code={input} />} code={input} language="json" />
            </Entry>
          </ToolApprovalContent>
        </ToolApproval>
      )}
    </Entity>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Components/Entity',
  component: Component,
  parameters: {},
  tags: ['autodocs'],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Component>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  argTypes: {
    variant: {
      control: 'select',
      options: ['initial', 'agent', 'workflow', 'tool', 'memory'],
    },
  },
  args: {
    variant: 'initial',
  },
};

export const OverrideByCustomClass: Story = {
  args: {
    className: 'mastra:bg-red-500',
  },
};

export const ExtandedByAdditionalClass: Story = {
  args: {
    additionalClass: 'mastra:bg-red-500',
  },
};

export const Disabled: Story = {
  argTypes: {
    variant: {
      control: 'select',
      options: ['initial', 'agent', 'workflow', 'tool', 'memory'],
    },
  },
  args: {
    variant: 'initial',
    requireApproval: true,
  },
};
