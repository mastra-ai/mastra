import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { AgentIcon } from './AgentIcon';
import { AiIcon } from './AiIcon';
import { ApiIcon } from './ApiIcon';
import { BranchIcon } from './BranchIcon';
import { DbIcon } from './DbIcon';
import { DeploymentIcon } from './DeploymentIcon';
import { DividerIcon } from './DividerIcon';
import { DocsIcon } from './DocsIcon';
import { EnvIcon } from './EnvIcon';
import { FiltersIcon } from './FiltersIcon';
import { HomeIcon } from './HomeIcon';
import { Icon } from './Icon';
import { JudgeIcon } from './JudgeIcon';
import { LogsIcon } from './LogsIcon';
import { OpenAIIcon } from './OpenAIIcon';
import { PromptIcon } from './PromptIcon';
import { ScoreIcon } from './ScoreIcon';
import { SettingsIcon } from './SettingsIcon';
import { SlashIcon } from './SlashIcon';
import { ToolsIcon } from './ToolsIcon';
import { TsIcon } from './TsIcon';
import { VariablesIcon } from './VariablesIcon';
import { WorkflowIcon } from './WorkflowIcon';

const ModelsIcons = [{ icon: OpenAIIcon, name: 'OpenAI' }];

const CommonsIcons = [
  { icon: AgentIcon, name: 'Agent' },
  { icon: JudgeIcon, name: 'Judge' },
  { icon: AiIcon, name: 'AI' },
  { icon: DeploymentIcon, name: 'Deployment' },
  { icon: SettingsIcon, name: 'Settings' },
  { icon: ToolsIcon, name: 'Tools' },
  { icon: DocsIcon, name: 'Docs' },
  { icon: ScoreIcon, name: 'Score' },
  { icon: VariablesIcon, name: 'Variables' },
  { icon: BranchIcon, name: 'Branch' },
  { icon: LogsIcon, name: 'Logs' },
  { icon: FiltersIcon, name: 'Filters' },
  { icon: DbIcon, name: 'Db' },
  { icon: PromptIcon, name: 'Prompt' },
  { icon: WorkflowIcon, name: 'Workflow' },
];

const WebIcons = [
  { icon: TsIcon, name: 'Ts' },
  { icon: ApiIcon, name: 'Api' },
  { icon: EnvIcon, name: 'Env' },
  { icon: HomeIcon, name: 'Home' },
];
const NavigationIcons = [
  { icon: DividerIcon, name: 'Divider' },
  { icon: SlashIcon, name: 'Slash' },
];

const IconWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface2 rounded-lg p-4">
      <Icon>{children}</Icon>
    </div>
  );
};

const Example = () => {
  return (
    <div className="text-icon6">
      <div className="">
        <h2 className="text-header-md leading-header-md pb-lg">Models Icons</h2>

        <div className="gap-lg grid grid-cols-4">
          {ModelsIcons.map(icon => (
            <IconWrapper key={icon.name}>
              <icon.icon />
            </IconWrapper>
          ))}
        </div>
      </div>

      <div className="">
        <h2 className="text-header-md leading-header-md pb-lg">Commons Icons</h2>

        <div className="gap-lg grid grid-cols-4">
          {CommonsIcons.map(icon => (
            <IconWrapper key={icon.name}>
              <icon.icon />
            </IconWrapper>
          ))}
        </div>
      </div>

      <div className="">
        <h2 className="text-header-md leading-header-md pb-lg">Navigation Icons</h2>

        <div className="gap-lg grid grid-cols-4">
          {WebIcons.map(icon => (
            <IconWrapper key={icon.name}>
              <icon.icon />
            </IconWrapper>
          ))}
        </div>
      </div>

      <div className="">
        <h2 className="text-header-md leading-header-md pb-lg">Web Icons</h2>

        <div className="gap-lg grid grid-cols-4">
          {NavigationIcons.map(icon => (
            <IconWrapper key={icon.name}>
              <icon.icon />
            </IconWrapper>
          ))}
        </div>
      </div>
    </div>
  );
};

// More on how to set up stories at: https://storybook.js.org/docs/writing-stories#default-export
const meta = {
  title: 'Primitives/Icons',
  component: Example,
  parameters: {
    // Optional parameter to center the component in the Canvas. More info: https://storybook.js.org/docs/configure/story-layout
    layout: 'centered',
  },
  // More on argTypes: https://storybook.js.org/docs/api/argtypes
  argTypes: {
    backgroundColor: { control: 'color' },
  },

  args: {},
} satisfies Meta<typeof Example>;

export default meta;
type Story = StoryObj<typeof meta>;

// More on writing stories with args: https://storybook.js.org/docs/writing-stories/args
export const All: Story = {
  args: {
    primary: true,
    label: 'All',
  },
};
