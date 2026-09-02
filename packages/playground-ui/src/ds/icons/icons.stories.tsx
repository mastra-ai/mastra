import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from './Icon';
import {
  AgentIcon,
  AgentCoinIcon,
  AgentNetworkCoinIcon,
  AiIcon,
  ApiIcon,
  BranchIcon,
  CheckIcon,
  ChevronIcon,
  CommitIcon,
  CrossIcon,
  DbIcon,
  DebugIcon,
  DeploymentIcon,
  DividerIcon,
  DocsIcon,
  EnvIcon,
  FiltersIcon,
  FolderIcon,
  GithubCoinIcon,
  GithubIcon,
  GoogleIcon,
  HomeIcon,
  InfoIcon,
  JudgeIcon,
  LatencyIcon,
  LogsIcon,
  McpCoinIcon,
  McpServerIcon,
  MemoryIcon,
  OpenAIIcon,
  PromptIcon,
  RepoIcon,
  SettingsIcon,
  SlashIcon,
  ToolCoinIcon,
  ToolsIcon,
  TraceIcon,
  TsIcon,
  VariablesIcon,
  WorkflowCoinIcon,
  WorkflowIcon,
} from './index';

const meta: Meta<typeof Icon> = {
  title: 'Icons/All Icons',
  component: Icon,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof Icon>;

const icons = [
  { name: 'AgentIcon', component: AgentIcon },
  { name: 'AgentCoinIcon', component: AgentCoinIcon },
  { name: 'AgentNetworkCoinIcon', component: AgentNetworkCoinIcon },
  { name: 'AiIcon', component: AiIcon },
  { name: 'ApiIcon', component: ApiIcon },
  { name: 'BranchIcon', component: BranchIcon },
  { name: 'CheckIcon', component: CheckIcon },
  { name: 'ChevronIcon', component: ChevronIcon },
  { name: 'CommitIcon', component: CommitIcon },
  { name: 'CrossIcon', component: CrossIcon },
  { name: 'DbIcon', component: DbIcon },
  { name: 'DebugIcon', component: DebugIcon },
  { name: 'DeploymentIcon', component: DeploymentIcon },
  { name: 'DividerIcon', component: DividerIcon },
  { name: 'DocsIcon', component: DocsIcon },
  { name: 'EnvIcon', component: EnvIcon },
  { name: 'FiltersIcon', component: FiltersIcon },
  { name: 'FolderIcon', component: FolderIcon },
  { name: 'GithubCoinIcon', component: GithubCoinIcon },
  { name: 'GithubIcon', component: GithubIcon },
  { name: 'GoogleIcon', component: GoogleIcon },
  { name: 'HomeIcon', component: HomeIcon },
  { name: 'InfoIcon', component: InfoIcon },
  { name: 'JudgeIcon', component: JudgeIcon },
  { name: 'LatencyIcon', component: LatencyIcon },
  { name: 'LogsIcon', component: LogsIcon },
  { name: 'McpCoinIcon', component: McpCoinIcon },
  { name: 'McpServerIcon', component: McpServerIcon },
  { name: 'MemoryIcon', component: MemoryIcon },
  { name: 'OpenAIIcon', component: OpenAIIcon },
  { name: 'PromptIcon', component: PromptIcon },
  { name: 'RepoIcon', component: RepoIcon },
  { name: 'SettingsIcon', component: SettingsIcon },
  { name: 'SlashIcon', component: SlashIcon },
  { name: 'ToolCoinIcon', component: ToolCoinIcon },
  { name: 'ToolsIcon', component: ToolsIcon },
  { name: 'TraceIcon', component: TraceIcon },
  { name: 'TsIcon', component: TsIcon },
  { name: 'VariablesIcon', component: VariablesIcon },
  { name: 'WorkflowCoinIcon', component: WorkflowCoinIcon },
  { name: 'WorkflowIcon', component: WorkflowIcon },
];

const IconGrid = ({ size = 'default' }: { size?: 'sm' | 'default' | 'lg' }) => (
  <div className="grid grid-cols-6 gap-4">
    {icons.map(({ name, component: IconComponent }) => (
      <div
        key={name}
        className="bg-gray-1 hover:bg-gray-2 flex flex-col items-center gap-2 rounded-lg p-3 transition-colors"
      >
        <Icon size={size} className="text-gray-10">
          <IconComponent />
        </Icon>
        <span className="text-gray-9 text-center text-xs">{name.replace('Icon', '')}</span>
      </div>
    ))}
  </div>
);

export const AllIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid />
    </div>
  ),
};

export const SmallIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid size="sm" />
    </div>
  ),
};

export const LargeIcons: Story = {
  render: () => (
    <div className="w-200">
      <IconGrid size="lg" />
    </div>
  ),
};

export const IconSizes: Story = {
  render: () => (
    <div className="flex items-end gap-8">
      <div className="flex flex-col items-center gap-2">
        <Icon size="sm" className="text-gray-10">
          <AgentIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Small</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size="default" className="text-gray-10">
          <AgentIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Default</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Icon size="lg" className="text-gray-10">
          <AgentIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Large</span>
      </div>
    </div>
  ),
};

export const IconColors: Story = {
  render: () => (
    <div className="flex gap-4">
      <Icon className="text-gray-9">
        <AgentIcon />
      </Icon>
      <Icon className="text-gray-10">
        <AgentIcon />
      </Icon>
      <Icon className="text-gray-10">
        <AgentIcon />
      </Icon>
      <Icon className="text-green-9">
        <AgentIcon />
      </Icon>
      <Icon className="text-green-9">
        <AgentIcon />
      </Icon>
      <Icon className="text-red-9">
        <AgentIcon />
      </Icon>
    </div>
  ),
};

export const AgentIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <AgentIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Agent</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <AgentCoinIcon />
        </Icon>
        <span className="text-gray-9 text-xs">AgentCoin</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <AgentNetworkCoinIcon />
        </Icon>
        <span className="text-gray-9 text-xs">AgentNetworkCoin</span>
      </div>
    </div>
  ),
};

export const WorkflowIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <WorkflowIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Workflow</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <WorkflowCoinIcon />
        </Icon>
        <span className="text-gray-9 text-xs">WorkflowCoin</span>
      </div>
    </div>
  ),
};

export const ToolIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <ToolsIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Tools</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <ToolCoinIcon />
        </Icon>
        <span className="text-gray-9 text-xs">ToolCoin</span>
      </div>
    </div>
  ),
};

export const BrandIcons: Story = {
  render: () => (
    <div className="flex gap-4">
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <GithubIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Github</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <GithubCoinIcon />
        </Icon>
        <span className="text-gray-9 text-xs">GithubCoin</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <GoogleIcon />
        </Icon>
        <span className="text-gray-9 text-xs">Google</span>
      </div>
      <div className="bg-gray-1 flex flex-col items-center gap-2 rounded-lg p-3">
        <Icon size="lg" className="text-gray-10">
          <OpenAIIcon />
        </Icon>
        <span className="text-gray-9 text-xs">OpenAI</span>
      </div>
    </div>
  ),
};
